import {
    SteamOpenIdStrategy,
    type IAxiosLikeHttpClient,
} from "passport-steam-openid"

const ENDPOINT = "https://steamcommunity.com/openid/login"
const MAX_BYTES = 8192
export function steamRedirect(returnURL: string) {
    const url = new URL(
        new SteamOpenIdStrategy({
            returnURL,
            profile: false,
        }).buildRedirectUrl()
    )
    url.searchParams.set("openid.realm", new URL(returnURL).origin)
    return url.toString()
}
export function createSteamVerifier(
    fetcher: typeof fetch = fetch,
    now = Date.now,
    timeoutMs = 8000
) {
    return async (parameters: URLSearchParams, expectedReturn: string) => {
        if (parameters.toString().length > MAX_BYTES)
            throw new Error("Invalid Steam assertion.")
        const query: Record<string, string> = {}
        for (const [key, value] of parameters) {
            if (parameters.getAll(key).length !== 1)
                throw new Error("Duplicate assertion parameter.")
            if (key !== "state") query[key] = value
        }
        const nonce = query["openid.response_nonce"] ?? ""
        const timestamp = Date.parse(nonce.slice(0, 20))
        if (
            !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ.+$/.test(nonce) ||
            !Number.isFinite(timestamp) ||
            timestamp < now() - 600_000 ||
            timestamp > now() + 60_000
        )
            throw new Error("Expired Steam assertion.")
        // The dependency owns protocol validation and check_authentication. This adapter
        // limits its only transport; it neither discovers providers nor verifies signatures.
        const httpClient: IAxiosLikeHttpClient = {
            get: async () => {
                throw new Error("Steam profile lookup is disabled.")
            },
            post: async <T>(url: string, body?: unknown) => {
                if (
                    url !== ENDPOINT ||
                    typeof body !== "string" ||
                    body.length > MAX_BYTES
                )
                    throw new Error("Invalid Steam verification request.")
                const controller = new AbortController()
                const timer = setTimeout(() => controller.abort(), timeoutMs)
                try {
                    const response = await fetcher(ENDPOINT, {
                        method: "POST",
                        redirect: "error",
                        signal: controller.signal,
                        cache: "no-store",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                            Origin: "https://steamcommunity.com",
                            Referer: "https://steamcommunity.com/",
                        },
                        body,
                    })
                    const reader = response.body?.getReader()
                    if (!reader)
                        throw new Error("Empty Steam verification response.")
                    let size = 0
                    const chunks: Uint8Array[] = []
                    try {
                        while (true) {
                            const { done, value } = await reader.read()
                            if (done) break
                            size += value.byteLength
                            if (size > MAX_BYTES)
                                throw new Error(
                                    "Oversized Steam verification response."
                                )
                            chunks.push(value)
                        }
                    } finally {
                        await reader.cancel().catch(() => undefined)
                    }
                    // Generic shape is required by the library's HTTP port. In profile:false
                    // mode it requests only this text response, which it validates itself.
                    return {
                        status: response.status,
                        data: Buffer.concat(chunks).toString("utf8") as T,
                    }
                } finally {
                    controller.abort()
                    clearTimeout(timer)
                }
            },
        }
        const strategy = new SteamOpenIdStrategy({
            returnURL: expectedReturn,
            profile: false,
            httpClient,
        })
        const user = await strategy.handleRequest({ query })
        return { platformId: user.steamid, nonce }
    }
}
