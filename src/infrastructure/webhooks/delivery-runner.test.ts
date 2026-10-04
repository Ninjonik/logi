import assert from "node:assert/strict"
import test from "node:test"

import { signWebhookPayload } from "@/domain/webhooks/signature"

import {
    runWebhookDelivery,
    type WebhookDeliveryCompletion,
} from "./delivery-runner"

const delivery = {
    id: "delivery-1",
    url: "https://hooks.example.test/logi",
    signingSecret: "secret",
    eventType: "article.created",
    payload: '{"id":"article-1"}',
}

test("runWebhookDelivery signs and records successful deliveries", async () => {
    const completions: Array<Record<string, unknown>> = []
    let request: Request | undefined
    const result = await runWebhookDelivery(delivery, {
        fetch: async (input, init) => {
            request = new Request(input, init)
            return new Response(null, { status: 204 })
        },
        finish: async (completion) => {
            completions.push(completion)
        },
        now: () => 1_700_000_000_000,
    })

    assert.deepEqual(result, { delivered: true })
    assert.deepEqual(completions, [
        { deliveryId: "delivery-1", delivered: true, responseStatus: 204 },
    ])
    assert.equal(request?.headers.get("X-Logi-Event"), "article.created")
    assert.equal(request?.headers.get("X-Logi-Delivery"), "delivery-1")
    assert.equal(request?.headers.get("X-Logi-Timestamp"), "1700000000")
    assert.equal(
        request?.headers.get("X-Logi-Signature"),
        signWebhookPayload("1700000000", delivery.payload, "secret")
    )
})

test("runWebhookDelivery records retryable and permanent HTTP failures", async () => {
    for (const status of [400, 408, 429, 500]) {
        const completions: Array<Record<string, unknown>> = []
        const result = await runWebhookDelivery(delivery, {
            fetch: async () => new Response(null, { status }),
            finish: async (completion) => {
                completions.push(completion)
            },
        })

        assert.deepEqual(result, { delivered: false })
        assert.deepEqual(completions, [
            {
                deliveryId: "delivery-1",
                delivered: false,
                responseStatus: status,
                error: `HTTP ${status}`,
            },
        ])
    }
})

test("runWebhookDelivery records network failures without a response status", async () => {
    const completions: Array<Record<string, unknown>> = []
    const result = await runWebhookDelivery(delivery, {
        fetch: async () => {
            throw new Error("connection reset")
        },
        finish: async (completion) => {
            completions.push(completion)
        },
    })

    assert.deepEqual(result, { delivered: false })
    assert.deepEqual(completions, [
        {
            deliveryId: "delivery-1",
            delivered: false,
            error: "Delivery request failed.",
        },
    ])
})

test("delivery uses a deadline and does not forward signatures through redirects", async () => {
    let init: RequestInit | undefined
    await runWebhookDelivery(delivery, {
        fetch: async (_url, options) => {
            init = options
            return new Response(null, { status: 302 })
        },
        finish: async () => {},
    })
    assert.equal(init?.redirect, "manual")
    assert.ok(init?.signal instanceof AbortSignal)
})
test("429 respects Retry-After and completion persistence is never retried as HTTP failure", async () => {
    let result: WebhookDeliveryCompletion | undefined
    await runWebhookDelivery(delivery, {
        fetch: async () =>
            new Response(null, {
                status: 429,
                headers: { "Retry-After": "120" },
            }),
        finish: async (input) => {
            result = input
        },
        now: () => 1000,
    })
    assert.equal(result?.retryAfterMs, 120_000)
    let calls = 0
    await assert.rejects(
        runWebhookDelivery(delivery, {
            fetch: async () => new Response(null, { status: 204 }),
            finish: async () => {
                calls++
                throw new Error("storage unavailable")
            },
        })
    )
    assert.equal(calls, 1)
})
