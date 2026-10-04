import {
    readDashboardJwt,
    signDashboardJwt,
    type SessionClaims,
    type SessionIdentity,
} from "../../infrastructure/identity/dashboard-jwt"
import { getInternalAuthSecret, getJwtSecret, getSiteUrl } from "../env"
import { isSsoCallback } from "../../domain/identity/sso-policy"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"
import { createSsoSecret } from "../sso"
export type { SessionClaims, SessionIdentity }
function config() {
    const issuer = getSiteUrl()
    if (
        !process.env.SITE_URL ||
        !isSsoCallback(
            issuer,
            process.env.LOGI_SSO_ALLOW_LOOPBACK_HTTP === "true"
        ) ||
        new URL(issuer).origin !== issuer
    )
        throw new Error("Invalid session issuer configuration.")
    return { secret: getJwtSecret(), issuer }
}
function binding(session: SessionClaims) {
    return {
        secret: getInternalAuthSecret(),
        sid: session.sid,
        subject: session.sub,
        userRecordId: session.userRecordId,
    }
}
export async function createDashboardToken(claims: SessionIdentity) {
    const environment = config()
    const record = (await fetchMutation(
        makeFunctionReference<"mutation">("dashboardSessions:create"),
        {
            secret: getInternalAuthSecret(),
            subject: claims.sub,
            sid: createSsoSecret(),
        }
    )) as {
        sid: string
        userRecordId: string
        createdAt: number
        expiresAt: number
    }
    return signDashboardJwt(
        { ...claims, sid: record.sid, userRecordId: record.userRecordId },
        record,
        environment
    )
}
export async function readDashboardToken(token: string) {
    return readDashboardJwt(token, config())
}
export async function verifyDashboardToken(token: string) {
    const session = await readDashboardToken(token)
    if (!session) return null
    try {
        return (await fetchQuery(
            makeFunctionReference<"query">("dashboardSessions:validate"),
            binding(session)
        ))
            ? session
            : null
    } catch {
        return null
    }
}
export async function revokeDashboardSession(
    session: SessionClaims,
    allSessions = false
) {
    await fetchMutation(
        makeFunctionReference<"mutation">("dashboardSessions:revoke"),
        { ...binding(session), allSessions }
    )
}
export async function readDashboardUser(session: SessionClaims) {
    return fetchQuery(
        makeFunctionReference<"query">("dashboardSessions:getUser"),
        binding(session)
    )
}
