import { signWebhookPayload } from "@/domain/webhooks/signature"

export type ClaimedWebhookDelivery = {
    id: string
    url: string
    signingSecret: string
    eventType: string
    payload: string
    fence?: number
}

export type WebhookDeliveryCompletion = {
    deliveryId: string
    delivered: boolean
    responseStatus?: number
    error?: string
    fence?: number
    retryAfterMs?: number
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
    let completion: WebhookDeliveryCompletion
    const identity = {
        deliveryId: delivery.id,
        ...(delivery.fence !== undefined ? { fence: delivery.fence } : {}),
    }
    try {
        const response = await dependencies.fetch(delivery.url, {
            method: "POST",
            redirect: "manual",
            signal: AbortSignal.timeout(10_000),
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
        const retryAfterMs = parseRetryAfter(
            response.headers.get("retry-after"),
            dependencies.now?.() ?? Date.now()
        )
        completion = {
            ...identity,
            delivered: response.ok,
            responseStatus: response.status,
            ...(!response.ok ? { error: `HTTP ${response.status}` } : {}),
            ...(!response.ok && retryAfterMs !== undefined
                ? { retryAfterMs }
                : {}),
        }
        void response.body?.cancel().catch(() => {})
    } catch {
        completion = {
            ...identity,
            delivered: false,
            error: "Delivery request failed.",
        }
    }
    // A persistence failure must not replace a successful HTTP outcome.
    await dependencies.finish(completion)
    return { delivered: completion.delivered }
}

export function parseRetryAfter(
    value: string | null,
    now: number
): number | undefined {
    if (!value) return undefined
    const delay = /^\d{1,9}$/.test(value)
        ? Number(value) * 1000
        : Date.parse(value) - now
    return Number.isFinite(delay) && delay >= 0 ? delay : undefined
}

export async function drainWebhookDeliveries(ports: {
    claim: () => Promise<ClaimedWebhookDelivery | null>
    deliver: (
        delivery: ClaimedWebhookDelivery
    ) => Promise<{ delivered: boolean }>
    now?: () => number
}) {
    const now = ports.now ?? Date.now,
        startedAt = now()
    let processed = 0,
        delivered = 0
    while (processed < 25 && now() - startedAt < 20_000) {
        const batch: ClaimedWebhookDelivery[] = []
        for (
            let i = 0;
            i < 4 &&
            processed + batch.length < 25 &&
            now() - startedAt < 20_000;
            i++
        ) {
            const delivery = await ports.claim()
            if (!delivery) break
            batch.push(delivery)
        }
        if (!batch.length) break
        const results = await Promise.allSettled(
            batch.map((value) => ports.deliver(value))
        )
        processed += batch.length
        delivered += results.filter(
            (result) => result.status === "fulfilled" && result.value.delivered
        ).length
        const failure = results.find((result) => result.status === "rejected")
        if (failure?.status === "rejected") throw failure.reason
    }
    return { processed, delivered }
}
