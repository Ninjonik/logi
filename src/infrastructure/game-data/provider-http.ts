import {
    ProviderError,
    sourceSchema,
    type DataSource,
    type ProviderHttp,
} from "../../domain/game-data/contracts"
import { credentialRequirement } from "../../domain/game-data/credentials"
import { allowsWarconUrl } from "../../domain/game-data/warcon-query"
import { lookup } from "node:dns/promises"
import { BlockList, isIP } from "node:net"
import { request } from "node:https"
type Lookup = (
    hostname: string
) => Promise<ReadonlyArray<{ address: string; family: number }>>
type Dependencies = {
    /**
     * Resolves the provider key immediately before a request. Absent for a
     * keyless source; a resolver failure is a configuration error and no other
     * key is ever tried.
     */
    credential?: () => Promise<string>
    now: () => number
    fetch?: typeof fetch
    timeoutMs?: number
    /** DNS resolution, replaceable in tests; the result is pinned for the connection. */
    lookup?: Lookup
}
const MAX_BYTES = 2 * 1024 * 1024
const blocked = new BlockList()
for (const [address, prefix] of [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
] as const)
    blocked.addSubnet(address, prefix, "ipv4")
const globalV6 = new BlockList()
globalV6.addSubnet("2000::", 3, "ipv6")
blocked.addSubnet("2001::", 23, "ipv6")
blocked.addSubnet("2001:db8::", 32, "ipv6")
blocked.addSubnet("2002::", 16, "ipv6")

export function isAllowedAddress(address: string, allowed: string[]) {
    const family = isIP(address)
    if (!family) return false
    if (allowed.length) return allowed.includes(address)
    return family === 4
        ? !blocked.check(address, "ipv4")
        : globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6")
}

/** Resolve once, enforce the operator policy, then connect to that exact address. */
async function pinnedFetch(
    source: DataSource,
    url: URL,
    init: RequestInit,
    resolve: Lookup
): Promise<Response> {
    const hostname = url.hostname.replace(/^\[|\]$/g, "")
    const addresses = isIP(hostname)
        ? [{ address: hostname, family: isIP(hostname) }]
        : await resolve(hostname)
    if (
        !addresses.length ||
        addresses.some(
            ({ address }) => !isAllowedAddress(address, source.allowedAddresses)
        )
    )
        throw new ProviderError("configuration")
    init.signal?.throwIfAborted()
    return new Promise((resolve, reject) => {
        const headers = Object.fromEntries(new Headers(init.headers))
        const req = request(
            {
                hostname: addresses[0].address,
                family: addresses[0].family,
                port: url.port || 443,
                path: url.pathname + url.search,
                method: "GET",
                servername: isIP(hostname) ? undefined : hostname,
                headers: { ...headers, host: url.host },
                agent: false,
                signal: init.signal ?? undefined,
            },
            (res) => {
                const chunks: Buffer[] = []
                let length = 0
                res.on("data", (chunk: Buffer) => {
                    length += chunk.length
                    if (length > MAX_BYTES) {
                        req.destroy(new ProviderError("invalid_response"))
                        return
                    }
                    chunks.push(chunk)
                })
                res.on("error", reject)
                res.on("end", () => {
                    const status = res.statusCode ?? 502
                    const responseHeaders = new Headers()
                    for (const name of [
                        "etag",
                        "retry-after",
                        "content-type",
                    ]) {
                        const value = res.headers[name]
                        if (typeof value === "string")
                            responseHeaders.set(name, value)
                    }
                    resolve(
                        new Response(
                            [204, 304].includes(status)
                                ? null
                                : Buffer.concat(chunks),
                            { status, headers: responseHeaders }
                        )
                    )
                })
            }
        )
        req.on("error", reject)
        req.end()
    })
}

async function boundedJson(response: Response) {
    if (!response.body) throw new ProviderError("invalid_response")
    const reader = response.body.getReader()
    let length = 0
    const chunks: Uint8Array[] = []
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            length += value.length
            if (length > MAX_BYTES) {
                await reader.cancel()
                throw new ProviderError("invalid_response")
            }
            chunks.push(value)
        }
        try {
            return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown
        } catch {
            throw new ProviderError("invalid_response")
        }
    } finally {
        reader.releaseLock()
    }
}

export function createProviderHttp(
    source: DataSource,
    deps: Dependencies
): ProviderHttp {
    const {
        ref,
        guildId,
        gameId,
        provider,
        providerServerId,
        origin,
        secretRef,
        allowedAddresses,
    } = source
    if (
        !sourceSchema.safeParse({
            ref,
            guildId,
            gameId,
            provider,
            providerServerId,
            origin,
            secretRef,
            allowedAddresses,
        }).success
    )
        throw new ProviderError("configuration")
    const expiresAt = deps.now() + 30_000
    const paths =
        source.provider === "hll_crcon"
            ? [
                  "/api/get_public_info",
                  "/api/get_connection_info",
                  "/api/get_live_game_stats",
                  "/api/get_scoreboard_maps",
                  "/api/get_map_scoreboard",
              ]
            : source.provider === "wardogs_rcon"
              ? ["/v1/capabilities", "/v1/status", "/v1/server-id"]
              : [`/v1/servers/${encodeURIComponent(source.providerServerId)}`]
    return {
        get: async (path, options) => {
            if (
                !path.startsWith("/") ||
                path.startsWith("//") ||
                path.includes("\\") ||
                path.length > 1000
            )
                throw new ProviderError("configuration")
            const url = new URL(path, source.origin)
            if (
                url.origin !== new URL(source.origin).origin ||
                !(source.provider === "wardogs_warcon"
                    ? allowsWarconUrl(url, source.providerServerId)
                    : paths.includes(url.pathname)) ||
                url.hash ||
                url.username ||
                url.password
            )
                throw new ProviderError("configuration")
            const timeout = Math.min(
                deps.timeoutMs ?? 10_000,
                10_000,
                expiresAt - deps.now()
            )
            if (timeout <= 0) throw new ProviderError("timeout")
            const headers = new Headers({
                accept: "application/json",
                "user-agent": "Logi-GameData/1.0",
            })
            const requirement = credentialRequirement(source.provider)
            if (
                (requirement === "required" && !deps.credential) ||
                (requirement === "forbidden" && deps.credential)
            )
                throw new ProviderError("configuration")
            if (deps.credential) {
                const secret = await deps.credential()
                // Visible ASCII only: a key can never add or split a header.
                if (!/^[\x21-\x7E]{1,4096}$/.test(secret))
                    throw new ProviderError("configuration")
                headers.set("authorization", `Bearer ${secret}`)
            }
            if (options?.etag) headers.set("if-none-match", options.etag)
            const controller = new AbortController()
            let timer: ReturnType<typeof setTimeout> | undefined
            const timedOut = new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                    controller.abort()
                    reject(new ProviderError("timeout"))
                }, timeout)
            })
            try {
                return await Promise.race([
                    timedOut,
                    (async () => {
                        const init: RequestInit = {
                            method: "GET",
                            headers,
                            signal: controller.signal,
                            redirect: "error",
                            cache: "no-store",
                        }
                        const response = deps.fetch
                            ? await deps.fetch(url, init)
                            : await pinnedFetch(
                                  source,
                                  url,
                                  init,
                                  deps.lookup ??
                                      ((hostname) =>
                                          lookup(hostname, { all: true }))
                              )
                        if (response.status === 401 || response.status === 403)
                            throw new ProviderError("unauthorized")
                        if (response.status === 429) {
                            const raw =
                                response.headers.get("retry-after") ?? ""
                            const milliseconds = /^\d+$/.test(raw)
                                ? Number(raw) * 1000
                                : Date.parse(raw) - deps.now()
                            throw new ProviderError(
                                "rate_limited",
                                Number.isFinite(milliseconds)
                                    ? Math.max(
                                          0,
                                          Math.min(milliseconds, 86_400_000)
                                      )
                                    : undefined
                            )
                        }
                        if (
                            [304, 404].includes(response.status) &&
                            (source.provider === "wardogs_public_directory" ||
                                (source.provider === "wardogs_warcon" &&
                                    response.status === 404))
                        )
                            return {
                                status: response.status,
                                body: null,
                                etag: response.headers.get("etag"),
                            }
                        if (!response.ok)
                            throw new ProviderError(
                                response.status >= 500
                                    ? "network"
                                    : "invalid_response"
                            )
                        return {
                            status: response.status,
                            body: await boundedJson(response),
                            etag: response.headers.get("etag"),
                        }
                    })(),
                ])
            } catch (error) {
                throw error instanceof ProviderError
                    ? error
                    : new ProviderError(
                          controller.signal.aborted ? "timeout" : "network"
                      )
            } finally {
                clearTimeout(timer)
            }
        },
    }
}
