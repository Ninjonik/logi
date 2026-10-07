import {
    base64UrlToBytes,
    clientGrantSigningInput,
    decodeClientGrantClaims,
    splitClientGrant,
} from "../src/domain/identity/client-grant"
import { activeDashboardSession } from "./dashboardSessionStore"
import type { QueryCtx } from "./_generated/server"

/**
 * The Discord ID the web server signed for `scope`, or null. The browser
 * cannot choose another user, resource or expiry without the secret, and the
 * grant ends with the dashboard session it was issued for. A missing secret
 * fails closed instead of falling back to a development default.
 */
export async function readClientGrant(
    ctx: Pick<QueryCtx, "db">,
    grant: string,
    scope: string,
    now = Date.now()
): Promise<string | null> {
    const secret = process.env.INTERNAL_AUTH_SECRET
    const parts = splitClientGrant(grant)
    const claims = parts ? decodeClientGrantClaims(parts.payload) : null
    if (
        !secret ||
        !parts ||
        !claims ||
        claims.scope !== scope ||
        claims.exp <= now
    )
        return null
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
    )
    const valid = await crypto.subtle.verify(
        "HMAC",
        key,
        base64UrlToBytes(parts.signature),
        encoder.encode(clientGrantSigningInput(parts.payload))
    )
    if (!valid) return null
    const session = await activeDashboardSession(ctx, claims.sid, claims.sub)
    return session ? claims.sub : null
}

/** Like `readClientGrant`, for writes: an unusable grant is an error. */
export async function verifyClientGrant(
    ctx: Pick<QueryCtx, "db">,
    grant: string,
    scope: string
): Promise<string> {
    const userId = await readClientGrant(ctx, grant, scope)
    if (!userId) throw new Error("Unauthorized.")
    return userId
}
