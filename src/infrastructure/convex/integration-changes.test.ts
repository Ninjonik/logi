import {
    CHANGE_RETENTION_MS,
    revisionOrder,
} from "../../domain/integrations/change"
import { appendIntegrationChange } from "../../../convex/integrationChangeLog"
import { withIntegrationChanges } from "../../../convex/integrationMutation"
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
test("collector bookkeeping times append no change; a health change does", async () => {
    const ctx = fixture()
    ctx.db.seed("gameDataConnections", {
        _id: "gameDataConnections:one",
        guildId: "guild-a",
        gameId: "wardogs",
        provider: "wardogs_warcon",
        enabled: true,
        generation: 1,
        errorCategory: null,
        historyCount: 1,
        historyErrorCategory: null,
        lastAttemptAt: "2026-10-06T10:00:00.000Z",
        nextAttemptAt: 1,
        historyLastSuccessAt: "2026-10-06T10:00:00.000Z",
        updatedAt: "2026-10-06T10:00:00.000Z",
    })
    await withIntegrationChanges(ctx as never, async (tracked) => {
        await tracked.db.patch("gameDataConnections:one" as never, {
            lastAttemptAt: "2026-10-06T10:00:01.000Z",
            nextAttemptAt: 2,
            historyLastSuccessAt: "2026-10-06T10:00:01.000Z",
            updatedAt: "2026-10-06T10:00:01.000Z",
        })
    })
    assert.equal(
        ctx.db.tables.integrationChanges?.length ?? 0,
        0,
        "a run that only advanced its times is not a change"
    )
    await withIntegrationChanges(ctx as never, async (tracked) => {
        await tracked.db.patch("gameDataConnections:one" as never, {
            errorCategory: "network",
        })
    })
    assert.deepEqual(
        ctx.db.tables.integrationChanges.map((row) => row.resource).sort(),
        ["integration-health", "server-snapshots"]
    )
})
test("a session seen again appends no player change; a changed one does", async () => {
    const ctx = fixture()
    ctx.db.seed("gameSessions", {
        _id: "gameSessions:one",
        connectionId: "gameDataConnections:one",
        guildId: "100000000000000001",
        gameId: "wardogs",
        externalId: "7",
        session: { externalId: "7", complete: false, players: [] },
        complete: false,
        fetchedAt: 1,
        sourceGeneration: 1,
        updatedAt: "2026-10-06T10:00:00.000Z",
    })
    await withIntegrationChanges(ctx as never, async (tracked) => {
        await tracked.db.patch("gameSessions:one" as never, {
            fetchedAt: 2,
            updatedAt: "2026-10-06T10:00:01.000Z",
        })
    })
    assert.equal(ctx.db.tables.integrationChanges?.length ?? 0, 0)
    await withIntegrationChanges(ctx as never, async (tracked) => {
        await tracked.db.patch("gameSessions:one" as never, { complete: true })
    })
    assert.deepEqual(
        ctx.db.tables.integrationChanges.map((row) => [
            row.resource,
            row.id,
            row.operation,
        ]),
        [["player-stat-summaries", "gameSessions:one", "upsert"]]
    )
})
function seedChange(
    ctx: ReturnType<typeof fixture>,
    revision: string,
    expiresAt: number
) {
    ctx.db.seed("integrationChanges", {
        _id: `integrationChanges:${revision}`,
        guildId: "guild-a",
        gameId: "wardogs",
        resource: "event-summaries",
        id: "events:one",
        revision,
        revisionOrder: revisionOrder(revision),
        operation: "upsert",
        expiresAt,
    })
}
test("prune raises a guild's floor once per batch, to the newest expired revision", async () => {
    const ctx = fixture()
    ctx.db.seed("integrationHeads", {
        _id: "integrationHeads:a",
        guildId: "guild-a",
        revision: "5",
        floor: "0",
    })
    for (const revision of ["1", "2", "3"])
        seedChange(ctx, revision, Date.now() - 1)
    seedChange(ctx, "4", Date.now() + CHANGE_RETENTION_MS)
    let headWrites = 0
    const patch = ctx.db.patch.bind(ctx.db)
    ctx.db.patch = async (id: string, value: Record<string, unknown>) => {
        if (id.startsWith("integrationHeads:")) headWrites++
        return patch(id, value)
    }
    await invoke(feed.prune, ctx)
    assert.equal(headWrites, 1, "one head write per guild and batch")
    assert.equal(ctx.db.tables.integrationHeads[0].floor, "3")
    assert.deepEqual(
        ctx.db.tables.integrationChanges.map((row) => row.revision),
        ["4"]
    )
    assert.equal(ctx.scheduler.calls.length, 0)
})
test("resetFeed raises every floor to its head and empties the log in batches", async () => {
    const ctx = fixture()
    ctx.db.seed("integrationHeads", {
        _id: "integrationHeads:a",
        guildId: "guild-a",
        revision: "700",
        floor: "2",
    })
    for (let i = 1; i <= 501; i++)
        seedChange(ctx, String(i), Date.now() + CHANGE_RETENTION_MS)
    assert.deepEqual(await invoke(feed.resetFeed, ctx), {
        removed: 500,
        done: false,
    })
    assert.equal(ctx.db.tables.integrationHeads[0].floor, "700")
    assert.deepEqual(
        (ctx.scheduler.calls[0] as unknown[])[2],
        { floorsRaised: true },
        "the continuation skips the head writes"
    )
    assert.deepEqual(
        await invoke(feed.resetFeed, ctx, { floorsRaised: true }),
        { removed: 1, done: true }
    )
    assert.equal(ctx.db.tables.integrationChanges.length, 0)
    assert.equal(
        (
            await invoke(feed.readChanges, ctx, {
                ...args,
                afterRevision: "3",
                issuedAt: Date.now(),
            })
        ).resetRequired,
        true,
        "a consumer below the new floor bootstraps again"
    )
    assert.equal(
        (await invoke(feed.readChanges, ctx, { ...args, startNow: true }))
            .revision,
        "700"
    )
})
