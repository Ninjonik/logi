/**
 * Client grants let a browser subscribe to or edit one Convex resource without
 * choosing its own identity. The web server signs `{ sub, scope, exp }` after
 * checking the session; Convex verifies the signature and uses `sub`, never a
 * user ID sent by the browser. This module holds only the format; signing and
 * verification live with each runtime's crypto.
 */
export const CLIENT_GRANT_VERSION = "logi-client-grant-v1"

/** Long enough for an editing session; the page issues a fresh grant on every load. */
export const CLIENT_GRANT_TTL_MS = 12 * 60 * 60 * 1000

export type ClientGrantClaims = {
    /** Discord ID of the signed-in user the server checked. */
    sub: string
    /** The single resource the grant covers, from the builders below. */
    scope: string
    /** Expiry, in milliseconds since the epoch. */
    exp: number
}

export const clientGrantScopes = {
    roster: (serverId: string, rosterId: string) =>
        `roster:${serverId}:${rosterId}`,
    stratmapCreate: (serverId: string) => `stratmaps:${serverId}`,
    stratmap: (stratmapId: string) => `stratmap:${stratmapId}`,
}

const toBase64Url = (value: string) =>
    btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

const fromBase64Url = (value: string) =>
    atob(
        value.replace(/-/g, "+").replace(/_/g, "/") +
            "=".repeat((4 - (value.length % 4)) % 4)
    )

/** Claims are ASCII (Discord and Convex IDs), so plain base64 is safe. */
export function encodeClientGrantClaims(claims: ClientGrantClaims) {
    return toBase64Url(JSON.stringify(claims))
}

export function decodeClientGrantClaims(
    payload: string
): ClientGrantClaims | null {
    if (!/^[A-Za-z0-9_-]{1,512}$/.test(payload)) return null
    try {
        const value = JSON.parse(fromBase64Url(payload)) as unknown
        if (!value || typeof value !== "object") return null
        const { sub, scope, exp } = value as Record<string, unknown>
        if (
            typeof sub !== "string" ||
            !/^\d{1,32}$/.test(sub) ||
            typeof scope !== "string" ||
            !scope ||
            scope.length > 200 ||
            typeof exp !== "number" ||
            !Number.isFinite(exp)
        )
            return null
        return { sub, scope, exp }
    } catch {
        return null
    }
}

/** The exact bytes that are signed, bound to this format version. */
export function clientGrantSigningInput(payload: string) {
    return `${CLIENT_GRANT_VERSION}.${payload}`
}

/** Splits `payload.signature`; returns null for anything else. */
export function splitClientGrant(grant: string) {
    const parts = grant.split(".")
    if (
        parts.length !== 2 ||
        !parts[0] ||
        !/^[A-Za-z0-9_-]{43}$/.test(parts[1])
    )
        return null
    return { payload: parts[0], signature: parts[1] }
}

export function base64UrlToBytes(value: string) {
    const binary = fromBase64Url(value)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1)
        bytes[index] = binary.charCodeAt(index)
    return bytes
}
