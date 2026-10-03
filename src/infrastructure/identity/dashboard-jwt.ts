import {
    DASHBOARD_SESSION_AUDIENCE,
    DASHBOARD_SESSION_TTL_MS,
    isDiscordSubject,
    isSsoOpaqueValue,
} from "../../domain/identity/sso-policy"
import { jwtVerify, SignJWT } from "jose"

export type SessionIdentity = {
    sub: string
    name: string
    avatar: string
    discordGuilds?: Array<{ id: string; canAdmin: boolean; botInside: boolean }>
}
export type SessionClaims = SessionIdentity & {
    sid: string
    userRecordId: string
}
export async function signDashboardJwt(
    claims: SessionClaims,
    lifetime: { createdAt: number; expiresAt: number },
    config: { secret: string; issuer: string }
) {
    return new SignJWT({
        name: claims.name,
        avatar: claims.avatar,
        discordGuilds: claims.discordGuilds ?? [],
        sid: claims.sid,
        usr: claims.userRecordId,
    })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject(claims.sub)
        .setIssuer(config.issuer)
        .setAudience(DASHBOARD_SESSION_AUDIENCE)
        .setIssuedAt(Math.floor(lifetime.createdAt / 1000))
        .setExpirationTime(Math.floor(lifetime.expiresAt / 1000))
        .sign(new TextEncoder().encode(config.secret))
}
export async function readDashboardJwt(
    token: string,
    config: { secret: string; issuer: string }
): Promise<SessionClaims | null> {
    try {
        if (token.length > 32768) return null
        const { payload } = await jwtVerify(
            token,
            new TextEncoder().encode(config.secret),
            {
                algorithms: ["HS256"],
                issuer: config.issuer,
                audience: DASHBOARD_SESSION_AUDIENCE,
                typ: "JWT",
                requiredClaims: ["sub", "iat", "exp", "sid", "usr"],
                maxTokenAge: DASHBOARD_SESSION_TTL_MS / 1000,
            }
        )
        if (
            typeof payload.sub !== "string" ||
            !isDiscordSubject(payload.sub) ||
            typeof payload.sid !== "string" ||
            !isSsoOpaqueValue(payload.sid) ||
            typeof payload.usr !== "string" ||
            !payload.usr ||
            typeof payload.name !== "string" ||
            typeof payload.avatar !== "string" ||
            typeof payload.iat !== "number" ||
            typeof payload.exp !== "number" ||
            payload.aud !== DASHBOARD_SESSION_AUDIENCE ||
            payload.iat > Math.floor(Date.now() / 1000) ||
            payload.exp - payload.iat > DASHBOARD_SESSION_TTL_MS / 1000
        )
            return null
        return {
            sub: payload.sub,
            sid: payload.sid,
            userRecordId: payload.usr,
            name: payload.name,
            avatar: payload.avatar,
            discordGuilds: Array.isArray(payload.discordGuilds)
                ? payload.discordGuilds.flatMap((candidate: unknown) => {
                      if (!candidate || typeof candidate !== "object") return []
                      const value = candidate as Record<string, unknown>
                      return typeof value.id === "string" &&
                          typeof value.canAdmin === "boolean" &&
                          typeof value.botInside === "boolean"
                          ? [
                                {
                                    id: value.id,
                                    canAdmin: value.canAdmin,
                                    botInside: value.botInside,
                                },
                            ]
                          : []
                  })
                : [],
        }
    } catch {
        return null
    }
}
