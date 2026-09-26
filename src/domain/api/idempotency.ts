export const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1_000

export function validateIdempotencyKey(value: string | null) {
    if (!value) return "Idempotency-Key is required."
    if (value.length > 200) return "Idempotency-Key is too long."
    if (!/^[\x21-\x7e]+$/.test(value))
        return "Idempotency-Key must contain visible ASCII characters only."
    return null
}
