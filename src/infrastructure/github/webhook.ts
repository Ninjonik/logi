import { createHmac, timingSafeEqual } from "node:crypto"
export function verifyGithubSignature(
    body: string,
    signature: string | null,
    secret: string
) {
    if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false
    const expected = createHmac("sha256", secret).update(body).digest()
    return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"))
}
