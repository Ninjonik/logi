import { createHmac } from "node:crypto"

/** Formats the exact X-Logi-Signature value for a raw JSON payload. */
export function signWebhookPayload(
    timestamp: string,
    rawBody: string,
    secret: string
) {
    return `sha256=${createHmac("sha256", secret)
        .update(`${timestamp}.${rawBody}`)
        .digest("hex")}`
}
