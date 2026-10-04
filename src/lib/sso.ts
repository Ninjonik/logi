import {
    isPkceVerifier,
    isPkceChallenge,
    isSsoCallback,
} from "../domain/identity/sso-policy"
import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
export {
    SSO_CODE_TTL_MS,
    SSO_ACCESS_TOKEN_TTL_MS,
} from "../domain/identity/sso-policy"
export function hashSsoValue(value: string) {
    return createHash("sha256").update(value).digest("hex")
}
export function createSsoSecret(bytes = 32) {
    return randomBytes(bytes).toString("base64url")
}
export function isExactHttpsUrl(value: string) {
    return isSsoCallback(value)
}
export function verifyPkceS256(verifier: string, challenge: string) {
    if (!isPkceVerifier(verifier) || !isPkceChallenge(challenge)) return false
    return timingSafeEqual(
        Buffer.from(createHash("sha256").update(verifier).digest("base64url")),
        Buffer.from(challenge)
    )
}
