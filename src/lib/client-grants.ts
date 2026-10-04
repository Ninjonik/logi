import { createHmac } from "node:crypto"

import {
    CLIENT_GRANT_TTL_MS,
    clientGrantSigningInput,
    encodeClientGrantClaims,
} from "@/domain/identity/client-grant"
import { getInternalAuthSecret } from "@/lib/env"

/**
 * Signs a grant for one resource after the caller has checked the session.
 * Convex verifies it with the same internal secret.
 */
export function issueClientGrant(
    discordId: string,
    scope: string,
    now = Date.now()
) {
    const payload = encodeClientGrantClaims({
        sub: discordId,
        scope,
        exp: now + CLIENT_GRANT_TTL_MS,
    })
    const signature = createHmac("sha256", getInternalAuthSecret())
        .update(clientGrantSigningInput(payload))
        .digest("base64url")
    return `${payload}.${signature}`
}
