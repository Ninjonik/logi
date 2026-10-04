import {
    base64UrlToBytes,
    clientGrantSigningInput,
    decodeClientGrantClaims,
    splitClientGrant,
} from "../src/domain/identity/client-grant"
import { INTERNAL_AUTH_SECRET } from "./discord_shared"

/**
 * Returns the Discord ID the web server signed for `scope`, or throws. The
 * browser cannot pick another user, resource or expiry without the secret.
 */
export async function verifyClientGrant(
    grant: string,
    scope: string,
    now = Date.now()
): Promise<string> {
    const parts = splitClientGrant(grant)
    const claims = parts ? decodeClientGrantClaims(parts.payload) : null
    if (!parts || !claims || claims.scope !== scope || claims.exp <= now)
        throw new Error("Unauthorized.")
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(INTERNAL_AUTH_SECRET),
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
    if (!valid) throw new Error("Unauthorized.")
    return claims.sub
}
