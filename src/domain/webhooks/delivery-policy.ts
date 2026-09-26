export const WEBHOOK_MAX_ATTEMPTS = 6

export function shouldRetryWebhookDelivery(
    responseStatus: number | undefined,
    nextAttempt: number
) {
    const transient =
        responseStatus === undefined ||
        responseStatus === 408 ||
        responseStatus === 429 ||
        responseStatus >= 500
    return transient && nextAttempt < WEBHOOK_MAX_ATTEMPTS
}

export function webhookRetryDelayMs(nextAttempt: number) {
    return Math.min(60 * 60_000, 1_000 * 2 ** nextAttempt)
}
