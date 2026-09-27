import { createHash, randomBytes, timingSafeEqual } from "crypto"

export const SSO_CODE_TTL_MS = 60_000
export const SSO_ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000

export function hashSsoValue(value: string) {
    return createHash("sha256").update(value).digest("hex")
}

export function createSsoSecret(bytes = 32) {
    return randomBytes(bytes).toString("base64url")
}

export function isExactHttpsUrl(value: string) {
    try {
        const url = new URL(value)
        return url.protocol === "https:" && !url.username && !url.password
    } catch {
        return false
    }
}

export function verifyPkceS256(verifier: string, challenge: string) {
    return timingSafeEqual(
        Buffer.from(hashSsoValue(verifier)),
        Buffer.from(challenge)
    )
}

export function buildSsoProfile(
    user: Record<string, unknown>,
    membership: "member" | "guest"
) {
    return { ...user, sso: { membership } }
}
