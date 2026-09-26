import assert from "node:assert/strict"
import test from "node:test"

import * as webhookDispatcher from "../../../convex/webhookDispatcher"
import * as webhookFunctions from "../../../convex/webhooks"

type Hook = {
    _id: string
    guildId: string
    url: string
    secret: string
    eventTypes: string[]
    enabled: boolean
    createdAt: string
    updatedAt: string
    lastDeliveredAt?: string
    lastFailureAt?: string
}
type Delivery = {
    _id: string
    webhookId: string
    guildId: string
    eventType: string
    payload: string
    attempt: number
    status: "pending" | "processing" | "delivered" | "failed"
    processingStartedAt?: number
    nextAttemptAt: number
    responseStatus?: number
    lastError?: string
    createdAt: string
    deliveredAt?: string
}
type Constraint = { field: string; value: unknown; operator: "eq" | "lte" }

class FakeQuery<T extends { _id: string }> {
    private constraints: Constraint[] = []

    constructor(private readonly documents: T[]) {}

    withIndex(
        _name: string,
        build: (query: {
            eq: (field: string, value: unknown) => unknown
            lte: (field: string, value: unknown) => unknown
        }) => unknown
    ) {
        const query = {
            eq: (field: string, value: unknown) => {
                this.constraints.push({ field, value, operator: "eq" })
                return query
            },
            lte: (field: string, value: unknown) => {
                this.constraints.push({ field, value, operator: "lte" })
                return query
            },
        }
        build(query)
        return this
    }

    async first() {
        return this.matching()[0] ?? null
    }

    async collect() {
        return this.matching()
    }

    private matching() {
        return this.documents.filter((document) =>
            this.constraints.every(({ field, value, operator }) => {
                const actual = document[field as keyof T]
                return operator === "eq"
                    ? actual === value
                    : (actual as number) <= (value as number)
            })
        )
    }
}

class FakeDb {
    readonly hooks = new Map<string, Hook>()
    readonly deliveries = new Map<string, Delivery>()

    async get(id: string) {
        return this.hooks.get(id) ?? this.deliveries.get(id) ?? null
    }

    async patch(id: string, value: Record<string, unknown>) {
        const document = await this.get(id)
        if (!document) throw new Error(`Document ${id} not found.`)
        Object.assign(document, value)
    }

    query(table: "webhookSubscriptions" | "webhookDeliveries") {
        return new FakeQuery<Hook | Delivery>(
            table === "webhookSubscriptions"
                ? [...this.hooks.values()]
                : [...this.deliveries.values()]
        )
    }
}

type WebhookHandler<Args, Context = { db: FakeDb }> = (
    ctx: Context,
    args: Args
) => Promise<unknown>
const internalSecret = "dev-internal-auth-secret"
const handler = <Args, Context = { db: FakeDb }>(value: unknown) =>
    (value as { _handler: WebhookHandler<Args, Context> })._handler

const hook = (overrides: Partial<Hook> = {}): Hook => ({
    _id: "hook-1",
    guildId: "guild-a",
    url: "https://hooks.example.test/logi",
    secret: "signing-secret",
    eventTypes: ["article.created"],
    enabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
})
const delivery = (overrides: Partial<Delivery> = {}): Delivery => ({
    _id: "delivery-1",
    webhookId: "hook-1",
    guildId: "guild-a",
    eventType: "article.created",
    payload: '{"id":"article-1"}',
    attempt: 0,
    status: "pending",
    nextAttemptAt: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
})

test("claimed successful deliveries update both delivery and subscription", async () => {
    const db = new FakeDb()
    db.hooks.set("hook-1", hook())
    db.deliveries.set("delivery-1", delivery())

    const claimed = await handler<{}>(webhookFunctions.claimDueDelivery)(
        { db },
        {}
    )
    assert.deepEqual(claimed, {
        id: "delivery-1",
        url: "https://hooks.example.test/logi",
        signingSecret: "signing-secret",
        eventType: "article.created",
        payload: '{"id":"article-1"}',
        attempt: 0,
    })

    await handler<{
        deliveryId: string
        delivered: boolean
        responseStatus?: number
        error?: string
    }>(webhookFunctions.finishDelivery)(
        { db },
        {
            deliveryId: "delivery-1",
            delivered: true,
            responseStatus: 204,
        }
    )

    assert.equal(db.deliveries.get("delivery-1")?.status, "delivered")
    assert.equal(db.deliveries.get("delivery-1")?.responseStatus, 204)
    assert.ok(db.deliveries.get("delivery-1")?.deliveredAt)
    assert.ok(db.hooks.get("hook-1")?.lastDeliveredAt)
})

test("disabled and deleted subscriptions safely fail queued or in-flight deliveries", async () => {
    const disabled = new FakeDb()
    disabled.hooks.set("hook-1", hook({ enabled: false }))
    disabled.deliveries.set("delivery-1", delivery())

    assert.equal(
        await handler<{}>(webhookFunctions.claimDueDelivery)(
            { db: disabled },
            {}
        ),
        null
    )
    assert.equal(disabled.deliveries.get("delivery-1")?.status, "failed")

    const deleted = new FakeDb()
    deleted.deliveries.set("delivery-1", delivery({ status: "processing" }))
    await handler<{
        deliveryId: string
        delivered: boolean
        responseStatus?: number
        error?: string
    }>(webhookFunctions.finishDelivery)(
        { db: deleted },
        {
            deliveryId: "delivery-1",
            delivered: true,
            responseStatus: 204,
        }
    )
    assert.equal(deleted.deliveries.get("delivery-1")?.status, "delivered")
})

test("queue retries transient failures and permanently fails client errors or exhausted work", async () => {
    for (const responseStatus of [undefined, 408, 429, 500]) {
        const db = new FakeDb()
        db.hooks.set("hook-1", hook())
        db.deliveries.set("delivery-1", delivery({ status: "processing" }))
        await handler<{
            deliveryId: string
            delivered: boolean
            responseStatus?: number
            error?: string
        }>(webhookFunctions.finishDelivery)(
            { db },
            {
                deliveryId: "delivery-1",
                delivered: false,
                responseStatus,
                error: "temporary failure",
            }
        )
        const result = db.deliveries.get("delivery-1")
        assert.equal(result?.status, "pending")
        assert.equal(result?.attempt, 1)
        assert.ok((result?.nextAttemptAt ?? 0) > Date.now() - 1_000)
    }

    const permanent = new FakeDb()
    permanent.hooks.set("hook-1", hook())
    permanent.deliveries.set("delivery-1", delivery({ status: "processing" }))
    await handler<{
        deliveryId: string
        delivered: boolean
        responseStatus?: number
        error?: string
    }>(webhookFunctions.finishDelivery)(
        { db: permanent },
        {
            deliveryId: "delivery-1",
            delivered: false,
            responseStatus: 400,
            error: "bad request",
        }
    )
    assert.equal(permanent.deliveries.get("delivery-1")?.status, "failed")
    assert.ok(permanent.hooks.get("hook-1")?.lastFailureAt)

    const exhausted = new FakeDb()
    exhausted.hooks.set("hook-1", hook())
    exhausted.deliveries.set(
        "delivery-1",
        delivery({ status: "processing", attempt: 5 })
    )
    await handler<{
        deliveryId: string
        delivered: boolean
        responseStatus?: number
        error?: string
    }>(webhookFunctions.finishDelivery)(
        { db: exhausted },
        {
            deliveryId: "delivery-1",
            delivered: false,
            error: "network failure",
        }
    )
    assert.equal(exhausted.deliveries.get("delivery-1")?.status, "failed")
    assert.equal(exhausted.deliveries.get("delivery-1")?.attempt, 6)
})

test("claiming recovers stale processing work before selecting a due delivery", async () => {
    const db = new FakeDb()
    db.hooks.set("hook-1", hook())
    db.deliveries.set(
        "delivery-1",
        delivery({
            status: "processing",
            processingStartedAt: Date.now() - 5 * 60_000 - 1,
        })
    )

    const claimed = await handler<{}>(webhookFunctions.claimDueDelivery)(
        { db },
        {}
    )
    assert.equal((claimed as { id: string }).id, "delivery-1")
    assert.equal(db.deliveries.get("delivery-1")?.status, "processing")
    assert.equal(
        db.deliveries.get("delivery-1")?.lastError,
        "Recovered abandoned delivery."
    )
})

test("dashboard delivery history rejects another guild's subscription", async () => {
    const db = new FakeDb()
    db.hooks.set("hook-1", hook())

    await assert.rejects(
        handler<{
            secret: string
            guildId: string
            webhookId: string
            cursor: string | null
            limit: number
        }>(webhookFunctions.listDeliveries)(
            { db },
            {
                secret: internalSecret,
                guildId: "guild-b",
                webhookId: "hook-1",
                cursor: null,
                limit: 25,
            }
        ),
        /Webhook not found/
    )
})

test("dispatcher finishes the one delivery it claims", async () => {
    const mutations: Array<{ reference: unknown; args: unknown }> = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => new Response(null, { status: 204 })
    try {
        const result = await handler<
            {},
            {
                runMutation: (
                    reference: unknown,
                    args: unknown
                ) => Promise<unknown>
            }
        >(webhookDispatcher.deliverDue)(
            {
                runMutation: async (reference: unknown, args: unknown) => {
                    mutations.push({ reference, args })
                    return mutations.length === 1
                        ? {
                              id: "delivery-1",
                              url: "https://hooks.example.test/logi",
                              signingSecret: "signing-secret",
                              eventType: "article.created",
                              payload: '{"id":"article-1"}',
                              attempt: 0,
                          }
                        : undefined
                },
            },
            {}
        )
        assert.deepEqual(result, { delivered: true })
        assert.equal(mutations.length, 2)
        assert.deepEqual(mutations[1]?.args, {
            deliveryId: "delivery-1",
            delivered: true,
            responseStatus: 204,
        })
    } finally {
        globalThis.fetch = originalFetch
    }
})
