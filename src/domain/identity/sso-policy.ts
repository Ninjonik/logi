export const SSO_CODE_TTL_MS = 60_000
export const SSO_ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000
export const DASHBOARD_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const DASHBOARD_SESSION_AUDIENCE = "logi-dashboard"

export function isSsoCallback(value: string, allowLoopbackHttp = false) {
    if (value.length > 2048 || value !== value.trim() || /[\s\\]/.test(value))
        return false
    try {
        const url = new URL(value)
        return (
            !url.username &&
            !url.password &&
            !url.hostname.includes("*") &&
            !value.includes("#") &&
            (url.protocol === "https:" ||
                (allowLoopbackHttp &&
                    url.protocol === "http:" &&
                    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
        )
    } catch {
        return false
    }
}

export const isPkceVerifier = (value: string) =>
    /^[A-Za-z0-9._~-]{43,128}$/.test(value)
export const isPkceChallenge = (value: string) =>
    /^[A-Za-z0-9_-]{43}$/.test(value)
export const isSsoHash = (value: string) => /^[a-f0-9]{64}$/.test(value)
export const isSsoOpaqueValue = (value: string) =>
    /^[A-Za-z0-9_-]{43}$/.test(value)
export const isSsoNonce = (value: string) => /^[\x21-\x7e]{1,256}$/.test(value)
export const isDiscordSubject = (value: string) => /^\d{17,22}$/.test(value)

export function normalizeSsoScope(value: string): string | null {
    const scopes = value.split(" ")
    if (
        !scopes.includes("openid") ||
        scopes.some((scope) => !["openid", "profile"].includes(scope)) ||
        new Set(scopes).size !== scopes.length
    )
        return null
    return scopes.includes("profile") ? "openid profile" : "openid"
}

export type SsoProfile = {
    sub: string
    name: string
    picture: string
    guild_id: string
    sid: string
}

export function ssoProfile(input: {
    subject: string
    name: string
    avatar: string
    guildId: string
    sid: string
}): SsoProfile {
    return {
        sub: input.subject,
        name: input.name,
        picture: input.avatar,
        guild_id: input.guildId,
        sid: input.sid,
    }
}

export type SsoGrant = {
    applicationRecordId: string
    clientId: string
    clientSecretHash: string
    guildId: string
    redirectUris: string[]
    code: {
        recordId: string
        applicationRecordId?: string
        clientSecretHash?: string
        clientId: string
        redirectUri: string
        userId: string
        userRecordId?: string
        sessionId?: string
        codeChallenge: string
        codeChallengeMethod: string
        nonce?: string
        scope?: string
        expiresAt: number
        usedAt?: number
    }
    session: {
        sid: string
        userRecordId: string
        subject: string
        expiresAt: number
    }
    user: { name: string; avatar: string }
}

export function validSsoGrant(
    grant: SsoGrant,
    input: {
        clientId: string
        clientSecretHash: string
        redirectUri: string
        challenge: string
    },
    now: number
) {
    const code = grant.code
    return (
        grant.clientId === input.clientId &&
        grant.clientSecretHash === input.clientSecretHash &&
        code.applicationRecordId === grant.applicationRecordId &&
        code.clientSecretHash === grant.clientSecretHash &&
        code.clientId === input.clientId &&
        code.redirectUri === input.redirectUri &&
        grant.redirectUris.includes(input.redirectUri) &&
        code.usedAt === undefined &&
        now < code.expiresAt &&
        now < grant.session.expiresAt &&
        code.sessionId === grant.session.sid &&
        code.userRecordId === grant.session.userRecordId &&
        code.userId === grant.session.subject &&
        code.codeChallengeMethod === "S256" &&
        isPkceChallenge(code.codeChallenge) &&
        code.codeChallenge === input.challenge &&
        typeof code.nonce === "string" &&
        isSsoNonce(code.nonce) &&
        typeof code.scope === "string" &&
        normalizeSsoScope(code.scope) === code.scope
    )
}
