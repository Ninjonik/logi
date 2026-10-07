import { invoke, testContext } from "../convex/testing/database"
import { drainWebhookDeliveries } from "./delivery-runner"

test("drain waits for its other in-flight deliveries before releasing a failed batch", async () => {
    let claims = 0,
        finished = 0
    await assert.rejects(
        drainWebhookDeliveries({
            claim: async () =>
                claims++ < 4
                    ? {
                          id: String(claims),
                          url: "https://example.test",
                          signingSecret: "fake",
                          payload: "{}",
                          eventType: "test",
                      }
                    : null,
            deliver: async (value) => {
                if (value.id === "1") throw new Error("storage unavailable")
                await new Promise((resolve) => setImmediate(resolve))
                finished++
                return { delivered: true }
            },
        })
    )
    assert.equal(finished, 3)
})
import * as queue from "../../../convex/webhookQueue"
import * as webhook from "../../../convex/webhooks"
import assert from "node:assert/strict"
import test from "node:test"

function fixture() {
    const ctx = testContext()
    ctx.db.seed("webhookSubscriptions", {
        _id: "webhookSubscriptions:one",
        guildId: "guild-a",
        url: "https://example.test/hooks",
        secret: "synthetic-secret",
        enabled: true,
        eventTypes: [],
    })
    ctx.db.seed("webhookDeliveries", {
        _id: "webhookDeliveries:one",
        webhookId: "webhookSubscriptions:one",
        guildId: "guild-a",
        payload: "{}",
        eventType: "webhook.test",
        attempt: 0,
        status: "pending",
        nextAttemptAt: 0,
        createdAt: new Date().toISOString(),
    })
    return ctx
}
test("stale completion cannot overwrite a newer delivery claim", async () => {
    const ctx = fixture(),
        row = ctx.db.tables.webhookDeliveries[0]
    Object.assign(row, {
        status: "processing",
        fence: 2,
        processingStartedAt: Date.now(),
        attempt: 2,
    })
    await invoke(webhook.finishDelivery, ctx, {
        deliveryId: row._id,
        fence: 1,
        delivered: true,
    })
    assert.equal(row.status, "processing")
})
test("100 deliveries drain in bounded batches with at most four concurrent requests", async () => {
    let remaining = 100,
        active = 0,
        peak = 0,
        completed = 0
    while (remaining) {
        const result = await drainWebhookDeliveries({
            claim: async () =>
                remaining-- > 0
                    ? {
                          id: String(remaining),
                          url: "https://example.test",
                          signingSecret: "fake",
                          payload: "{}",
                          eventType: "test",
                      }
                    : null,
            deliver: async () => {
                active++
                peak = Math.max(peak, active)
                await new Promise((resolve) => setImmediate(resolve))
                active--
                return { delivered: true }
            },
        })
        assert.equal(result.processed, 25)
        completed += result.delivered
    }
    assert.equal(completed, 100)
    assert.equal(peak, 4)
})
test("expired HTTP lease is recovered and old response remains fenced out", async () => {
    const ctx = fixture(),
        fence = await invoke(queue.beginDrain, ctx)
    const first = await invoke(queue.claimDueDelivery, ctx, {
            drainFence: fence,
        }),
        row = ctx.db.tables.webhookDeliveries[0]
    row.processingStartedAt = Date.now() - 30_001
    await invoke(queue.finishDelivery, ctx, {
        deliveryId: row._id,
        fence: first.fence,
        delivered: true,
    })
    assert.equal(row.status, "processing")
    ctx.db.tables.webhookDispatchState[0].leaseUntil = 0
    const secondFence = await invoke(queue.beginDrain, ctx),
        second = await invoke(queue.claimDueDelivery, ctx, {
            drainFence: secondFence,
        })
    assert.ok(second.fence > first.fence)
    await invoke(queue.finishDelivery, ctx, {
        deliveryId: row._id,
        fence: first.fence,
        delivered: true,
    })
    assert.equal(row.status, "processing")
    await invoke(queue.finishDelivery, ctx, {
        deliveryId: row._id,
        fence: second.fence,
        delivered: true,
        responseStatus: 204,
    })
    assert.equal(row.status, "delivered")
})
test("retry delay, permanent errors and attempt ceiling are persisted", async () => {
    for (const status of [400, 408, 429, 500, undefined]) {
        const ctx = fixture(),
            started = Date.now(),
            fence = await invoke(queue.beginDrain, ctx)
        const claim = await invoke(queue.claimDueDelivery, ctx, {
            drainFence: fence,
        })
        await invoke(queue.finishDelivery, ctx, {
            deliveryId: claim.id,
            fence: claim.fence,
            delivered: false,
            responseStatus: status,
            retryAfterMs: 120_000,
        })
        const row = ctx.db.tables.webhookDeliveries[0]
        assert.equal(row.status, status === 400 ? "failed" : "pending")
        assert.ok(row.nextAttemptAt >= started + 120_000)
        if (row.status === "pending") assert.ok(ctx.scheduler.calls.length)
    }
    const ctx = fixture(),
        row = ctx.db.tables.webhookDeliveries[0]
    Object.assign(row, {
        status: "processing",
        fence: 6,
        attempt: 6,
        processingStartedAt: Date.now(),
    })
    await invoke(queue.finishDelivery, ctx, {
        deliveryId: row._id,
        fence: 6,
        delivered: false,
        responseStatus: 500,
    })
    assert.equal(row.status, "failed")
})
test("tenant rotation prevents a busy guild blocking another and continuation is durable", async () => {
    const ctx = fixture()
    for (let i = 0; i < 100; i++)
        ctx.db.seed("webhookDeliveries", {
            ...ctx.db.tables.webhookDeliveries[0],
            _id: `webhookDeliveries:a-${i}`,
        })
    ctx.db.seed("webhookSubscriptions", {
        ...ctx.db.tables.webhookSubscriptions[0],
        _id: "webhookSubscriptions:two",
        guildId: "guild-b",
    })
    ctx.db.seed("webhookDeliveries", {
        ...ctx.db.tables.webhookDeliveries[0],
        _id: "webhookDeliveries:b",
        guildId: "guild-b",
        webhookId: "webhookSubscriptions:two",
    })
    const fence = await invoke(queue.beginDrain, ctx)
    await invoke(queue.claimDueDelivery, ctx, { drainFence: fence })
    assert.equal(
        (await invoke(queue.claimDueDelivery, ctx, { drainFence: fence })).id,
        "webhookDeliveries:b"
    )
    assert.equal(await invoke(queue.beginDrain, ctx), null)
    await invoke(queue.endDrain, ctx, { fence })
    assert.ok(ctx.scheduler.calls.length)
})
test("deleted subscription preserves in-flight audit; disabled work fails safely", async () => {
    const ctx = fixture(),
        fence = await invoke(queue.beginDrain, ctx),
        claim = await invoke(queue.claimDueDelivery, ctx, { drainFence: fence })
    await ctx.db.delete("webhookSubscriptions:one")
    await invoke(queue.finishDelivery, ctx, {
        deliveryId: claim.id,
        fence: claim.fence,
        delivered: true,
    })
    assert.equal(ctx.db.tables.webhookDeliveries[0].status, "delivered")
    const disabled = fixture()
    disabled.db.tables.webhookSubscriptions[0].enabled = false
    const disabledFence = await invoke(queue.beginDrain, disabled)
    assert.equal(
        await invoke(queue.claimDueDelivery, disabled, {
            drainFence: disabledFence,
        }),
        null
    )
    assert.equal(disabled.db.tables.webhookDeliveries[0].status, "failed")
})
test("a drain with nothing due takes no lease and writes nothing", async () => {
    const ctx = fixture()
    // The first drain finishes the migration and delivers the one webhook.
    const fence = await invoke(queue.beginDrain, ctx)
    const claim = await invoke(queue.claimDueDelivery, ctx, {
        drainFence: fence,
    })
    await invoke(queue.finishDelivery, ctx, {
        deliveryId: claim.id,
        fence: claim.fence,
        delivered: true,
    })
    assert.equal(
        await invoke(queue.claimDueDelivery, ctx, { drainFence: fence }),
        null
    )
    await invoke(queue.endDrain, ctx, { fence })
    const writes: string[] = []
    const patch = ctx.db.patch.bind(ctx.db)
    const insert = ctx.db.insert.bind(ctx.db)
    ctx.db.patch = async (id, value) => {
        writes.push(id)
        return await patch(id, value)
    }
    ctx.db.insert = async (table, value) => {
        writes.push(table)
        return await insert(table, value)
    }
    for (let minute = 0; minute < 3; minute++)
        assert.equal(await invoke(queue.beginDrain, ctx), null)
    assert.deepEqual(writes, [])
    // A new delivery wakes its guild: the next drain takes the lease once.
    await ctx.db.insert("webhookDispatchGuilds", {
        guildId: "guild-a",
        wakeAt: 0,
    })
    writes.length = 0
    assert.equal(typeof (await invoke(queue.beginDrain, ctx)), "number")
    assert.deepEqual(writes, [ctx.db.tables.webhookDispatchState[0]._id])
})
test("delivery history enforces guild ownership", async () => {
    await assert.rejects(
        invoke(webhook.listDeliveries, fixture(), {
            secret: "dev-internal-auth-secret",
            guildId: "other",
            webhookId: "webhookSubscriptions:one",
            cursor: null,
            limit: 25,
        }),
        /Webhook not found/
    )
})
