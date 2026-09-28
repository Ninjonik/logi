import { testContext, invoke } from "./testing/database"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("actual bot event mutation appends both summary invalidations", async () => {
    process.env.INTERNAL_AUTH_SECRET = "synthetic-sync-secret"
    const events = await import("../../../convex/events")
    const ctx = testContext()
    ctx.db.seed("events", {
        _id: "events:one",
        guildId: "guild-a",
        gameId: "wardogs",
        name: "Test",
        gameEnd: "2026-09-28T15:00:00Z",
    })
    await invoke(events.setDiscordEventRoles, ctx, {
        secret: "synthetic-sync-secret",
        eventId: "events:one",
        attendeeRoleId: "synthetic-role",
    })
    assert.deepEqual(
        ctx.db.tables.integrationChanges?.map((row) => row.resource).sort(),
        ["event-summaries", "match-summaries"]
    )
})

test("dashboard upsert, API upsert, result import and legacy migration emit transactional changes", async () => {
    process.env.INTERNAL_AUTH_SECRET = "synthetic-sync-secret"
    const events = await import("../../../convex/events")
    const api = await import("../../../convex/publicApi")
    const migrations = await import("../../../convex/migrations")
    const ctx = testContext()
    ctx.db.seed("guilds", { _id: "guilds:one", discordId: "guild-a" })
    const input = {
        kind: "match",
        gameId: "wardogs",
        name: "Operational match",
        registrationEnd: "2030-01-01T10:00:00Z",
        meetingStart: "2030-01-01T11:00:00Z",
        gameStart: "2030-01-01T12:00:00Z",
        gameEnd: "2030-01-01T14:00:00Z",
        pingClan: false,
    }
    const id = await invoke(events.upsert, ctx, {
        secret: "synthetic-sync-secret",
        serverId: "guilds:one",
        ...input,
    })
    assert.equal(ctx.db.tables.integrationChanges.length, 2)
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:one",
        guildId: "guild-a",
        keyHash: "legacy-writer",
    })
    const result = await invoke(api.mutateClanEvent, ctx, {
        secret: "synthetic-sync-secret",
        keyHash: "legacy-writer",
        idempotencyKey: "synthetic-create",
        bodyHash: "body",
        methodPath: "POST /clan/events",
        operation: "create",
        event: input,
    })
    assert.equal(result.status, 201)
    assert.equal(ctx.db.tables.integrationChanges.length, 4)
    const eventResult = {
        sourceUrl: "https://private.test/no-export",
        mapId: "test",
        sideA: "a",
        sideB: "b",
        score: { sideA: 0, sideB: 2 },
        outcome: "defeat",
        importedAt: new Date().toISOString(),
    }
    await invoke(events.setResult, ctx, {
        secret: "synthetic-sync-secret",
        eventId: id,
        eventResult,
    })
    assert.equal(ctx.db.tables.integrationChanges.length, 6)
    const row = await ctx.db.get(id)
    row!.eventResult = {
        ...eventResult,
        sideA: undefined,
        sideB: undefined,
        score: { axis: 0, allied: 2 },
    }
    await invoke(migrations.migrateEventResults, ctx, {
        secret: "synthetic-sync-secret",
    })
    assert.equal(ctx.db.tables.integrationChanges.length, 8)
    assert.equal(
        JSON.stringify(ctx.db.tables.integrationChanges).includes(
            "private.test"
        ),
        false
    )
})

test("registered authoritative writers keep transaction tracking at their Convex entrypoints", () => {
    for (const writer of [
        "events",
        "publicApi",
        "migrations",
        "matchStats",
        "serverSetup",
        "competitions",
        "gameData",
        "gameDataHistory",
    ]) {
        const source = readFileSync(`convex/${writer}.ts`, "utf8")
        assert.match(
            source,
            /import \{[^}]*mutation[^}]*\} from "\.\/integrationMutation"|import \{[^}]*internalMutation[^}]*\} from "\.\/integrationMutation"/,
            writer
        )
        assert.doesNotMatch(
            source,
            /import \{[^}]*\b(?:mutation|internalMutation)\b[^}]*\} from "\.\/_generated\/server"/,
            writer
        )
    }
})
