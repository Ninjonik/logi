import {
    isPkceChallenge,
    isPkceVerifier,
    isSsoCallback,
    isSsoNonce,
    isSsoOpaqueValue,
    normalizeSsoScope,
    type SsoProfile,
} from "../../domain/identity/sso-policy"
import type { SessionClaims } from "../../infrastructure/identity/dashboard-jwt"

export const ssoHeaders = {
    "cache-control": "no-store",
    pragma: "no-cache",
    "referrer-policy": "no-referrer",
}
export function ssoError(error: string, status = 400) {
    return Response.json({ error }, { status, headers: ssoHeaders })
}
function singleParameters(params: URLSearchParams) {
    if (params.toString().length > 8192) throw new Error("Invalid request")
    const result: Record<string, string> = Object.create(null)
    for (const [key, value] of params) {
        if (
            key in result ||
            key.length > 64 ||
            value.length > 2048 ||
            /[\x00-\x1f\x7f]/.test(value)
        )
            throw new Error("Invalid request")
        result[key] = value
    }
    return result
}
async function boundedForm(request: Request) {
    if (
        request.headers
            .get("content-type")
            ?.split(";")[0]
            .trim()
            .toLowerCase() !== "application/x-www-form-urlencoded" ||
        Number(request.headers.get("content-length") ?? 0) > 8192 ||
        !request.body
    )
        throw new Error("Invalid form")
    const reader = request.body.getReader()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            (async () => {
                const chunks: Uint8Array[] = []
                let length = 0
                while (true) {
                    const part = await reader.read()
                    if (part.done) break
                    length += part.value.byteLength
                    if (length > 8192) throw new Error("Invalid form")
                    chunks.push(part.value)
                }
                const result = new Uint8Array(length)
                let offset = 0
                for (const chunk of chunks) {
                    result.set(chunk, offset)
                    offset += chunk.byteLength
                }
                return singleParameters(
                    new URLSearchParams(
                        new TextDecoder("utf-8", { fatal: true }).decode(result)
                    )
                )
            })(),
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error("Invalid form")),
                    10_000
                )
            }),
        ])
    } finally {
        if (timer) clearTimeout(timer)
        await reader.cancel().catch(() => undefined)
    }
}
type Redemption = SsoProfile & {
    nonce: string
    scope: string
    issuedAt: number
    expiresAt: number
}
export type SsoRoutePorts = {
    provider(): Promise<{
        issuer: string
        allowLoopbackHttp: boolean
        jwks: { keys: object[] }
        sign(profile: Redemption, clientId: string): Promise<string>
    }>
    client(
        clientId: string
    ): Promise<{ redirectUris: string[]; defaultLanguage: string } | null>
    session(): Promise<SessionClaims | null>
    createCode(input: {
        clientId: string
        redirectUri: string
        sid: string
        subject: string
        userRecordId: string
        codeHash: string
        codeChallenge: string
        nonce: string
        scope: string
    }): Promise<void>
    redeem(input: {
        clientId: string
        clientSecretHash: string
        codeHash: string
        redirectUri: string
        verifier: string
        tokenHash: string
    }): Promise<Redemption | null>
    profile(tokenHash: string): Promise<SsoProfile | null>
    random(): string
    hash(value: string): string
}
export function ssoRoutes(ports: SsoRoutePorts) {
    return {
        authorize: async (request: Request) => {
            let provider
            try {
                provider = await ports.provider()
            } catch {
                return ssoError("temporarily_unavailable", 503)
            }
            let params: Record<string, string>
            try {
                params = singleParameters(new URL(request.url).searchParams)
            } catch {
                return ssoError("invalid_request")
            }
            const {
                client_id: clientId,
                redirect_uri: redirectUri,
                state,
                code_challenge: codeChallenge,
                nonce,
            } = params
            if (
                params.response_type !== "code" ||
                !clientId ||
                !redirectUri ||
                !isSsoCallback(redirectUri, provider.allowLoopbackHttp) ||
                !state ||
                state.length > 1024 ||
                !nonce ||
                !isSsoNonce(nonce) ||
                !codeChallenge ||
                !isPkceChallenge(codeChallenge) ||
                params.code_challenge_method !== "S256" ||
                (params.prompt !== undefined && params.prompt !== "none")
            )
                return ssoError("invalid_request")
            const scope = normalizeSsoScope(params.scope ?? "")
            if (!scope) return ssoError("invalid_scope")
            try {
                const client = await ports.client(clientId)
                if (!client?.redirectUris.includes(redirectUri))
                    return ssoError("invalid_client")
                const session = await ports.session()
                if (!session) {
                    if (params.prompt === "none")
                        return ssoError("login_required")
                    const url = new URL(request.url)
                    const login = new URL("/api/auth/discord", provider.issuer)
                    login.searchParams.set(
                        "redirectTo",
                        `${url.pathname}${url.search}`
                    )
                    return new Response(null, {
                        status: 302,
                        headers: { ...ssoHeaders, location: login.href },
                    })
                }
                const code = ports.random()
                await ports.createCode({
                    clientId,
                    redirectUri,
                    sid: session.sid,
                    subject: session.sub,
                    userRecordId: session.userRecordId,
                    codeHash: ports.hash(code),
                    codeChallenge,
                    nonce,
                    scope,
                })
                const destination = new URL(redirectUri)
                destination.searchParams.set("code", code)
                destination.searchParams.set("state", state)
                return new Response(null, {
                    status: 302,
                    headers: { ...ssoHeaders, location: destination.href },
                })
            } catch {
                return ssoError("temporarily_unavailable", 503)
            }
        },
        token: async (request: Request) => {
            let provider
            try {
                provider = await ports.provider()
            } catch {
                return ssoError("temporarily_unavailable", 503)
            }
            let params: Record<string, string>
            try {
                params = await boundedForm(request)
            } catch {
                return ssoError("invalid_request")
            }
            const {
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri,
                code_verifier: verifier,
            } = params
            if (
                request.headers.has("authorization") ||
                params.grant_type !== "authorization_code" ||
                !clientId ||
                !clientSecret ||
                clientSecret.length > 256 ||
                !code ||
                !isSsoOpaqueValue(code) ||
                !redirectUri ||
                !isSsoCallback(redirectUri, provider.allowLoopbackHttp) ||
                !verifier ||
                !isPkceVerifier(verifier)
            )
                return ssoError("invalid_request")
            try {
                const accessToken = ports.random()
                const tokenHash = ports.hash(accessToken)
                const result = await ports.redeem({
                    clientId,
                    clientSecretHash: ports.hash(clientSecret),
                    codeHash: ports.hash(code),
                    redirectUri,
                    verifier,
                    tokenHash,
                })
                if (!result) return ssoError("invalid_grant")
                const idToken = await provider.sign(result, clientId)
                const current = await ports.profile(tokenHash)
                if (
                    !current ||
                    current.sub !== result.sub ||
                    current.sid !== result.sid ||
                    current.guild_id !== result.guild_id
                )
                    return ssoError("invalid_grant")
                return Response.json(
                    {
                        access_token: accessToken,
                        token_type: "Bearer",
                        expires_in: Math.max(
                            0,
                            Math.floor((result.expiresAt - Date.now()) / 1000)
                        ),
                        scope: result.scope,
                        id_token: idToken,
                    },
                    { headers: ssoHeaders }
                )
            } catch {
                return ssoError("temporarily_unavailable", 503)
            }
        },
        userinfo: async (request: Request) => {
            try {
                await ports.provider()
            } catch {
                return ssoError("temporarily_unavailable", 503)
            }
            const token = request.headers
                .get("authorization")
                ?.match(/^Bearer ([A-Za-z0-9_-]{43})$/i)?.[1]
            if (!token) return ssoError("invalid_token", 401)
            try {
                const profile = await ports.profile(ports.hash(token))
                return profile
                    ? Response.json(
                          {
                              sub: profile.sub,
                              name: profile.name,
                              picture: profile.picture,
                              guild_id: profile.guild_id,
                              sid: profile.sid,
                          },
                          { headers: ssoHeaders }
                      )
                    : ssoError("invalid_token", 401)
            } catch {
                return ssoError("temporarily_unavailable", 503)
            }
        },
        discovery: async () => {
            try {
                const { issuer } = await ports.provider()
                return Response.json(
                    {
                        issuer,
                        authorization_endpoint: `${issuer}/api/sso/authorize`,
                        token_endpoint: `${issuer}/api/sso/token`,
                        userinfo_endpoint: `${issuer}/api/sso/userinfo`,
                        jwks_uri: `${issuer}/api/sso/jwks`,
                        response_types_supported: ["code"],
                        response_modes_supported: ["query"],
                        grant_types_supported: ["authorization_code"],
                        subject_types_supported: ["public"],
                        scopes_supported: ["openid", "profile"],
                        claims_supported: [
                            "sub",
                            "iss",
                            "aud",
                            "iat",
                            "exp",
                            "nonce",
                            "sid",
                            "guild_id",
                            "name",
                            "picture",
                        ],
                        code_challenge_methods_supported: ["S256"],
                        token_endpoint_auth_methods_supported: [
                            "client_secret_post",
                        ],
                        id_token_signing_alg_values_supported: ["RS256"],
                    },
                    { headers: ssoHeaders }
                )
            } catch {
                return ssoError("temporarily_unavailable", 503)
            }
        },
        jwks: async () => {
            try {
                return Response.json((await ports.provider()).jwks, {
                    headers: ssoHeaders,
                })
            } catch {
                return ssoError("temporarily_unavailable", 503)
            }
        },
    }
}
