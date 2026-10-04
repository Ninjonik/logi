import { appendIntegrationChange } from "../../../convex/integrationChangeLog"
import { withIntegrationChanges } from "../../../convex/integrationMutation"
import { CHANGE_RETENTION_MS } from "../../domain/integrations/change"
import * as feed from "../../../convex/integrationChanges"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

process.env.INTERNAL_AUTH_SECRET = "synthetic-sync-secret"
const args = {
    secret: "synthetic-sync-secret",
    keyHash: "reader",
    gameId: "wardogs",
    resources: ["event-summaries"],
    limit: 2,
}
function fixture() {
    const ctx = testContext()
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:reader",
        keyHash: "reader",
        guildId: "guild-a",
        readAccess: {
            resources: ["event-summaries", "match-summaries"],
            gameIds: ["wardogs"],
        },
    })
    ctx.db.seed("events", {
        _id: "events:one",
        guildId: "guild-a",
        gameId: "wardogs",
        name: "Safe title",
        gameEnd: "2026-09-28T15:00:00Z",
        serverPassword: "never-export",
    })
    return ctx
}
test("bootstrap boundary and atomic projection revision start at zero", async () => {
    const ctx = fixture()
    assert.equal(
        (await invoke(feed.readChanges, ctx, { ...args, startNow: true }))
            .revision,
        "0"
    )
    const record = await invoke(feed.readSyncRecord, ctx, {
        ...args,
        resource: "event-summaries",
        id: "events:one",
    })
    assert.equal(record.revision, "0")
    assert.equal(record.data.title, "Safe title")
    assert.equal(JSON.stringify(record).includes("never-export"), false)
})
test("scope move invalidates old game and atomic detail returns a tombstone", async () => {
    const ctx = fixture()
    await withIntegrationChanges(ctx as never, async (tracked) => {
        await tracked.db.patch("events:one" as never, {
            gameId: "hell_let_loose",
        })
    })
    const result = await invoke(feed.readChanges, ctx, {
        ...args,
        afterRevision: "0",
        issuedAt: Date.now(),
    })
    assert.equal(result.items[0].operation, "remove")
    assert.equal(result.items.length, 1)
    const record = await invoke(feed.readSyncRecord, ctx, {
        ...args,
        resource: "event-summaries",
        id: "events:one",
    })
    assert.equal(record.operation, "remove")
    assert.equal(record.data, null)
})
test("wrong scope, missing grant, legacy and revoked key cannot expose IDs", async () => {
    const ctx = fixture()
    for (const patch of [
        { guildId: "guild-b" },
        { readAccess: undefined },
        { revokedAt: "now" },
    ]) {
        const key = ctx.db.tables.apiKeys[0],
            old = structuredClone(key)
        Object.assign(key, patch)
        assert.equal(
            await invoke(feed.readSyncRecord, ctx, {
                ...args,
                resource: "event-summaries",
                id: "events:one",
            }),
            null
        )
        Object.assign(key, old)
        delete key.revokedAt
    }
    assert.equal(
        await invoke(feed.readChanges, ctx, {
            ...args,
            resources: ["integration-health"],
            startNow: true,
        }),
        null
    )
    assert.equal(
        await invoke(feed.readChanges, ctx, {
            ...args,
            gameId: "hell_let_loose",
            startNow: true,
        }),
        null
    )
})
test("expired cursor explicitly requires bootstrap", async () => {
    assert.equal(
        (
            await invoke(feed.readChanges, fixture(), {
                ...args,
                afterRevision: "0",
                issuedAt: Date.now() - CHANGE_RETENTION_MS - 1,
            })
        ).resetRequired,
        true
    )
})
test("rolled back mutation publishes neither revision nor webhook", async () => {
    const ctx = fixture()
    ctx.db.seed("webhookSubscriptions", {
        _id: "webhookSubscriptions:one",
        guildId: "guild-a",
        enabled: true,
        eventTypes: ["integration.changed"],
    })
    await assert.rejects(
        invoke(
            {
                _handler: async () => {
                    await appendIntegrationChange(ctx as never, {
                        guildId: "guild-a",
                        gameId: "wardogs",
                        resource: "event-summaries",
                        id: "events:one",
                        operation: "upsert",
                    })
                    throw new Error("transaction aborted")
                },
            },
            ctx
        )
    )
    assert.equal(ctx.db.tables.integrationHeads, undefined)
    assert.equal(ctx.db.tables.webhookDeliveries, undefined)
    assert.equal(ctx.scheduler.calls.length, 0)
})
