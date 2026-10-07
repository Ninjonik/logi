import {
    CHANGE_RETENTION_MS,
    revisionOrder,
} from "../../domain/integrations/change"
import { appendIntegrationChange } from "../../../convex/integrationChangeLog"
import { withIntegrationChanges } from "../../../convex/integrationMutation"
import { invoke, spyReads, testContext } from "./testing/database"
import * as feed from "../../../convex/integrationChanges"
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
test("rolled back mutation publishes no revision", async () => {
    const ctx = fixture()
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
    assert.equal(ctx.db.tables.integrationChanges, undefined)
})
const change = (guildId: string) => ({
    guildId,
    gameId: "wardogs",
    resource: "event-summaries" as const,
    id: "events:one",
    operation: "upsert" as const,
})
test("an append enqueues no webhook, even for a subscription to the retired event types", async () => {
    const ctx = fixture()
    ctx.db.seed("webhookSubscriptions", {
        _id: "webhookSubscriptions:one",
        guildId: "guild-a",
        enabled: true,
        eventTypes: ["integration.changed", "membership.changed"],
    })
    const reads = spyReads(ctx)
    assert.equal(
        await appendIntegrationChange(ctx as never, change("guild-a")),
        "1"
    )
    await appendIntegrationChange(ctx as never, {
        ...change("guild-a"),
        resource: "membership-summaries",
        id: "100000000000000001",
    })
    assert.equal(ctx.db.tables.integrationChanges.length, 2)
    assert.equal(ctx.db.tables.webhookDeliveries, undefined)
    assert.equal(ctx.scheduler.calls.length, 0)
    assert.equal(
        reads.some((read) => read.table === "webhookSubscriptions"),
        false
    )
})
test("a guild without a key that reads the feed gets no change, record or head write", async () => {
    const ctx = fixture()
    const writes: string[] = []
    const insert = ctx.db.insert.bind(ctx.db),
        patch = ctx.db.patch.bind(ctx.db)
    ctx.db.insert = async (table: string, value: Record<string, unknown>) => {
        writes.push(table)
        return insert(table, value)
    }
    ctx.db.patch = async (id: string, value: Record<string, unknown>) => {
        writes.push(id.split(":")[0])
        return patch(id, value)
    }
    for (const key of [
        { _id: "apiKeys:legacy", guildId: "guild-b", keyHash: "legacy" },
        {
            _id: "apiKeys:revoked",
            guildId: "guild-b",
            keyHash: "revoked",
            revokedAt: "2026-10-01T00:00:00.000Z",
            readAccess: {
                resources: ["event-summaries"],
                gameIds: ["wardogs"],
            },
        },
        {
            _id: "apiKeys:live-state",
            guildId: "guild-b",
            keyHash: "live-state",
            readAccess: {
                resources: ["server-snapshots", "integration-health"],
                gameIds: ["wardogs"],
            },
        },
    ])
        ctx.db.seed("apiKeys", key)
    const reads = spyReads(ctx)
    assert.equal(
        await appendIntegrationChange(ctx as never, change("guild-b")),
        null
    )
    assert.deepEqual(writes, [])
    assert.deepEqual(reads, [{ table: "apiKeys", index: "guildId" }])
    await appendIntegrationChange(ctx as never, change("guild-a"))
    assert.deepEqual(writes.sort(), [
        "integrationChanges",
        "integrationHeads",
        "integrationRecords",
    ])
    assert.ok(
        [
            ...ctx.db.tables.integrationChanges,
            ...ctx.db.tables.integrationRecords,
            ...ctx.db.tables.integrationHeads,
        ].every((row) => row.guildId === "guild-a")
    )
})
test("a change expires two days after it is written; an older cursor bootstraps again", async () => {
    const ctx = fixture()
    const before = Date.now()
    await appendIntegrationChange(ctx as never, {
        ...change("guild-a"),
        operation: "remove",
    })
    const twoDays = 2 * 24 * 60 * 60 * 1000
    const [row] = ctx.db.tables.integrationChanges
    assert.ok(row.expiresAt >= before + twoDays)
    assert.ok(row.expiresAt <= Date.now() + twoDays)
    assert.equal(
        ctx.db.tables.integrationRecords[0].expiresAt,
        row.expiresAt,
        "the tombstone follows the change"
    )
    assert.equal(
        (
            await invoke(feed.readChanges, ctx, {
                ...args,
                afterRevision: "0",
                issuedAt: Date.now() - twoDays - 1,
            })
        ).resetRequired,
        true
    )
})
test("a collector's connection writes are live state and never reach the feed", async () => {
    const ctx = fixture()
    const observation = (observedAt: string, players: number) => ({
        observedAt,
        providerUpdatedAt: null,
        displayName: "Fixture",
        state: "online" as const,
        map: null,
        players,
        capacity: 100,
        providerInstanceId: null,
        scores: [],
        capabilities: ["server_snapshot" as const],
    })
    ctx.db.tables.apiKeys[0].readAccess = {
        resources: [
            "event-summaries",
            "server-snapshots",
            "integration-health",
        ],
        gameIds: ["wardogs"],
    }
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
        observation: observation("2026-10-06T10:00:00.000Z", 1),
        lastAttemptAt: "2026-10-06T10:00:00.000Z",
        nextAttemptAt: 1,
        historyLastSuccessAt: "2026-10-06T10:00:00.000Z",
        updatedAt: "2026-10-06T10:00:00.000Z",
    })
    await withIntegrationChanges(ctx as never, async (tracked) => {
        await tracked.db.patch("gameDataConnections:one" as never, {
            observation: observation("2026-10-06T10:01:00.000Z", 2),
            errorCategory: "network",
            historyCount: 2,
            lastAttemptAt: "2026-10-06T10:01:00.000Z",
        })
    })
    assert.equal(ctx.db.tables.integrationChanges, undefined)
    assert.equal(ctx.db.tables.integrationHeads, undefined)
    const live = { ...args, resources: ["server-snapshots"] }
    const start = await invoke(feed.readChanges, ctx, {
        ...live,
        startNow: true,
    })
    assert.deepEqual(start.items, [], "the retired names are still accepted")
    const replay = await invoke(feed.readChanges, ctx, {
        ...live,
        afterRevision: start.revision,
        issuedAt: Date.now(),
    })
    assert.equal(replay.resetRequired, false)
    assert.deepEqual(replay.items, [])
    const record = await invoke(feed.readSyncRecord, ctx, {
        ...live,
        resource: "integration-health",
        id: "gameDataConnections:one",
    })
    assert.equal(record.operation, "upsert", "the current record is served")
})
test("a session seen again appends no player change; a changed one does", async () => {
    const ctx = fixture()
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:people",
        keyHash: "people",
        guildId: "100000000000000001",
        readAccess: {
            resources: ["player-stat-summaries"],
            gameIds: ["wardogs"],
        },
    })
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
