import { signWebhookPayload } from "@/domain/webhooks/signature"

export type ClaimedWebhookDelivery = {
    id: string
    url: string
    signingSecret: string
    eventType: string
    payload: string
}

export type WebhookDeliveryCompletion = {
    deliveryId: string
    delivered: boolean
    responseStatus?: number
    error?: string
}

/** Sends one already-claimed delivery and records its HTTP-level outcome. */
export async function runWebhookDelivery(
    delivery: ClaimedWebhookDelivery,
    dependencies: {
        fetch: typeof fetch
        finish: (input: WebhookDeliveryCompletion) => Promise<void>
        now?: () => number
    }
): Promise<{ delivered: boolean }> {
    const timestamp = Math.floor(
        (dependencies.now?.() ?? Date.now()) / 1_000
    ).toString()
    const signature = signWebhookPayload(
        timestamp,
        delivery.payload,
        delivery.signingSecret
    )
    try {
        const response = await dependencies.fetch(delivery.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Logi-Webhooks/1.0",
                "X-Logi-Event": delivery.eventType,
                "X-Logi-Delivery": delivery.id,
                "X-Logi-Timestamp": timestamp,
                "X-Logi-Signature": signature,
            },
            body: delivery.payload,
        })
        await dependencies.finish({
            deliveryId: delivery.id,
            delivered: response.ok,
            responseStatus: response.status,
            ...(!response.ok ? { error: `HTTP ${response.status}` } : {}),
        })
        return { delivered: response.ok }
    } catch (error) {
        await dependencies.finish({
            deliveryId: delivery.id,
            delivered: false,
            error: error instanceof Error ? error.message : "Delivery failed.",
        })
        return { delivered: false }
    }
}
