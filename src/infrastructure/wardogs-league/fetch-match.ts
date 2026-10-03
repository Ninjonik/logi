import {
    LeagueError,
    MAX_RETRY_AFTER_MS,
    type LeagueSnapshot,
} from "../../domain/wardogs-league/contracts"
import { matchUrl } from "../../domain/wardogs-league/match-url"
import { isAllowedAddress } from "../game-data/provider-http"
import { parseMatchHtml } from "./parse-match"
import { lookup } from "node:dns/promises"
import { request } from "node:https"

const MAX_BYTES = 2 * 1024 * 1024
/** No proxy/cookie jar/automatic redirect. TLS verifies the original host against a pinned public IP. */
const pinnedGet: typeof fetch = async (input, init) => {
    const url = new URL(String(input))
    const addresses = await lookup(url.hostname, { all: true })
    if (
        !addresses.length ||
        addresses.some((a) => !isAllowedAddress(a.address, []))
    )
        throw new LeagueError("unsafe_redirect")
    init?.signal?.throwIfAborted()
    return new Promise((resolve, reject) => {
        const req = request(
            {
                hostname: addresses[0].address,
                family: addresses[0].family,
                port: 443,
                servername: url.hostname,
                path: url.pathname,
                method: "GET",
                agent: false,
                headers: {
                    ...Object.fromEntries(new Headers(init?.headers)),
                    host: url.hostname,
                },
                signal: init?.signal ?? undefined,
            },
            (res) => {
                const chunks: Buffer[] = []
                let bytes = 0
                res.on("data", (chunk: Buffer) => {
                    bytes += chunk.length
                    if (bytes > MAX_BYTES) {
                        req.destroy(new LeagueError("too_large"))
                        return
                    }
                    chunks.push(chunk)
                })
                res.on("error", reject)
                res.on("end", () => {
                    const headers = new Headers()
                    for (const name of [
                        "content-type",
                        "retry-after",
                        "location",
                    ]) {
                        const value = res.headers[name]
                        if (typeof value === "string") headers.set(name, value)
                    }
                    const status = res.statusCode ?? 502
                    resolve(
                        new Response(
                            [204, 205, 304].includes(status)
                                ? null
                                : Buffer.concat(chunks),
                            { status, headers }
                        )
                    )
                })
            }
        )
        req.on("error", reject)
        req.end()
    })
}

export async function fetchLeagueMatch(
    sourceUrl: string,
    deps: { fetch?: typeof fetch; now?: () => number; timeoutMs?: number } = {}
): Promise<LeagueSnapshot> {
    const source = matchUrl(sourceUrl),
        now = deps.now ?? Date.now
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(
            () => {
                reject(new LeagueError("timeout"))
                controller.abort()
            },
            Math.min(deps.timeoutMs ?? 15000, 15000)
        )
    })
    const work = async () => {
        let url = source.url
        for (let redirects = 0; redirects <= 3; redirects++) {
            controller.signal.throwIfAborted()
            const response = await (deps.fetch ?? pinnedGet)(url, {
                method: "GET",
                redirect: "manual",
                signal: controller.signal,
                headers: {
                    accept: "text/html",
                    "accept-encoding": "identity",
                    "accept-language": "en",
                    "user-agent":
                        "Logi-League/1.0 (+https://github.com/Ninjonik/logi; public match preview)",
                },
            })
            if ([301, 302, 303, 307, 308].includes(response.status)) {
                void response.body?.cancel().catch(() => {})
                try {
                    const location = response.headers.get("location")
                    if (!location || redirects === 3) throw new Error()
                    const target = new URL(location, url)
                    if (matchUrl(target.href).id !== source.id)
                        throw new Error()
                    url = target.href
                } catch {
                    throw new LeagueError("unsafe_redirect")
                }
                continue
            }
            if (response.status === 429) {
                void response.body?.cancel().catch(() => {})
                const header = response.headers.get("retry-after") ?? ""
                const delay = /^\d+$/.test(header)
                    ? Number(header) * 1000
                    : Date.parse(header) - now()
                throw new LeagueError(
                    "rate_limited",
                    Number.isFinite(delay) && delay >= 0
                        ? Math.min(MAX_RETRY_AFTER_MS, Math.max(1000, delay))
                        : 60000
                )
            }
            if (response.status !== 200) {
                void response.body?.cancel().catch(() => {})
                throw new LeagueError("http")
            }
            if (
                !/^text\/html(?:\s*;|\s*$)/i.test(
                    response.headers.get("content-type") ?? ""
                ) ||
                !response.body
            ) {
                void response.body?.cancel().catch(() => {})
                throw new LeagueError("invalid_html")
            }
            const reader = response.body.getReader(),
                chunks: Uint8Array[] = []
            const cancel = () => {
                void reader.cancel().catch(() => {})
            }
            controller.signal.addEventListener("abort", cancel, { once: true })
            let bytes = 0
            try {
                while (true) {
                    controller.signal.throwIfAborted()
                    const { value, done } = await reader.read()
                    if (done) break
                    bytes += value.byteLength
                    if (bytes > MAX_BYTES) {
                        cancel()
                        throw new LeagueError("too_large")
                    }
                    chunks.push(value)
                }
                return {
                    ...parseMatchHtml(
                        Buffer.concat(chunks).toString("utf8"),
                        source.url
                    ),
                    fetchedAt: new Date(now()).toISOString(),
                }
            } finally {
                controller.signal.removeEventListener("abort", cancel)
                reader.releaseLock()
            }
        }
        throw new LeagueError("unsafe_redirect")
    }
    try {
        return await Promise.race([work(), deadline])
    } catch (error) {
        throw error instanceof LeagueError
            ? error
            : new LeagueError(controller.signal.aborted ? "timeout" : "network")
    } finally {
        clearTimeout(timer)
    }
}
