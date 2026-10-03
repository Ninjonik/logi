import {
    hllProfileUrl,
    type HllProfile,
    type StatsPeriod,
} from "../../domain/player-stats/player-stats"
import { isAllowedAddress } from "../game-data/provider-http"
import { parseHllProfile } from "./parse-profile"
import { lookup } from "node:dns/promises"
import { request } from "node:https"

const MAX_BYTES = 2 * 1024 * 1024
export type HllRead = {
    status: "ok" | "stale" | "empty" | "unavailable"
    profile: HllProfile | null
    fetchedAt: string | null
    reason: string | null
}

/** Fixed public host, pinned public DNS address, TLS verification, no cookies or redirects. */
const publicGet: typeof fetch = async (input, init) => {
    const url = new URL(String(input)),
        addresses = await lookup(url.hostname, { all: true })
    if (
        url.origin !== "https://hllrecords.com" ||
        !addresses.length ||
        addresses.some((a) => !isAllowedAddress(a.address, []))
    )
        throw new Error("unsafe_address")
    init?.signal?.throwIfAborted()
    return new Promise((resolve, reject) => {
        const req = request(
            {
                hostname: addresses[0].address,
                family: addresses[0].family,
                servername: url.hostname,
                port: 443,
                path: url.pathname + url.search,
                method: "GET",
                agent: false,
                signal: init?.signal ?? undefined,
                headers: {
                    ...Object.fromEntries(new Headers(init?.headers)),
                    host: url.hostname,
                },
            },
            (res) => {
                const chunks: Buffer[] = []
                let bytes = 0
                res.on("data", (chunk: Buffer) => {
                    bytes += chunk.length
                    if (bytes > MAX_BYTES) {
                        req.destroy(new Error("too_large"))
                        return
                    }
                    chunks.push(chunk)
                })
                res.on("error", reject)
                res.on("end", () => {
                    const status = res.statusCode ?? 502,
                        headers = new Headers()
                    for (const key of ["content-type", "retry-after"]) {
                        const value = res.headers[key]
                        if (typeof value === "string") headers.set(key, value)
                    }
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

/** Bounded process cache, single-flight requests and provider-wide 403/429 backoff. */
export function createHllRecordsReader(
    deps: { fetch?: typeof fetch; now?: () => number; timeoutMs?: number } = {}
) {
    const now = deps.now ?? Date.now
    const cache = new Map<string, { result: HllRead; nextAt: number }>(),
        pending = new Map<string, Promise<HllRead>>()
    let blockedUntil = 0,
        blockedReason = "blocked"
    return async function read(
        id: string,
        period: StatsPeriod
    ): Promise<HllRead> {
        const url = hllProfileUrl(id, period),
            previous = cache.get(url),
            timestamp = now()
        if (previous && timestamp < previous.nextAt) return previous.result
        const failed = (reason: string): HllRead => ({
            status: previous?.result.profile ? "stale" : "unavailable",
            profile: previous?.result.profile ?? null,
            fetchedAt: previous?.result.fetchedAt ?? null,
            reason,
        })
        if (timestamp < blockedUntil) return failed(blockedReason)
        const active = pending.get(url)
        if (active) return active
        if (pending.size >= 8) return failed("busy")
        const work = async (): Promise<HllRead> => {
            const controller = new AbortController()
            let timer: ReturnType<typeof setTimeout> | undefined,
                retry = 60_000
            const deadline = new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => {
                        controller.abort()
                        reject(new Error("timeout"))
                    },
                    Math.max(1, Math.min(deps.timeoutMs ?? 7000, 7000))
                )
            })
            try {
                const result = await Promise.race([
                    deadline,
                    (async (): Promise<HllRead> => {
                        const response = await (deps.fetch ?? publicGet)(url, {
                            signal: controller.signal,
                            redirect: "manual",
                            headers: {
                                accept: "text/html",
                                "accept-encoding": "identity",
                                "accept-language": "en",
                                "user-agent":
                                    "Logi-Stats/1.0 (+https://github.com/Ninjonik/logi; public player statistics)",
                            },
                        })
                        if (response.status !== 200) {
                            void response.body?.cancel().catch(() => {})
                            if (response.status === 404)
                                return {
                                    status: "empty",
                                    profile: null,
                                    fetchedAt: new Date(
                                        timestamp
                                    ).toISOString(),
                                    reason: null,
                                }
                            if (response.status === 429) {
                                const header =
                                        response.headers.get("retry-after") ??
                                        "",
                                    delay = /^\d+$/.test(header)
                                        ? Number(header) * 1000
                                        : Date.parse(header) - now()
                                retry = Number.isFinite(delay)
                                    ? Math.max(1000, delay)
                                    : 60_000
                                blockedUntil = now() + retry
                                blockedReason = "rate_limited"
                                throw new Error("rate_limited")
                            }
                            if (response.status === 403) {
                                blockedUntil = now() + 15 * 60_000
                                blockedReason = "blocked"
                                retry = 15 * 60_000
                                throw new Error("blocked")
                            }
                            throw new Error("upstream")
                        }
                        if (
                            !/^text\/html(?:;|$)/i.test(
                                response.headers.get("content-type") ?? ""
                            ) ||
                            !response.body
                        ) {
                            void response.body?.cancel().catch(() => {})
                            throw new Error("invalid_html")
                        }
                        const reader = response.body.getReader(),
                            chunks: Uint8Array[] = []
                        let size = 0
                        const cancel = () => {
                            void reader.cancel().catch(() => {})
                        }
                        controller.signal.addEventListener("abort", cancel, {
                            once: true,
                        })
                        try {
                            for (;;) {
                                controller.signal.throwIfAborted()
                                const part = await reader.read()
                                if (part.done) break
                                size += part.value.length
                                if (size > MAX_BYTES) {
                                    cancel()
                                    throw new Error("too_large")
                                }
                                chunks.push(part.value)
                            }
                        } finally {
                            controller.signal.removeEventListener(
                                "abort",
                                cancel
                            )
                            reader.releaseLock()
                        }
                        const profile = parseHllProfile(
                            Buffer.concat(chunks).toString("utf8"),
                            id,
                            period
                        )
                        return {
                            status:
                                profile.matches === 0 && profile.kills === 0
                                    ? "empty"
                                    : "ok",
                            profile,
                            fetchedAt: new Date(timestamp).toISOString(),
                            reason: null,
                        }
                    })(),
                ])
                cache.set(url, { result, nextAt: now() + 15 * 60_000 })
                return result
            } catch (error) {
                const reason = controller.signal.aborted
                    ? "timeout"
                    : error instanceof Error &&
                        ["blocked", "rate_limited"].includes(error.message)
                      ? error.message
                      : "upstream"
                const result = failed(reason)
                cache.set(url, { result, nextAt: now() + retry })
                return result
            } finally {
                clearTimeout(timer)
                while (cache.size > 200)
                    cache.delete(cache.keys().next().value!)
                pending.delete(url)
            }
        }
        const promise = work()
        pending.set(url, promise)
        return promise
    }
}
