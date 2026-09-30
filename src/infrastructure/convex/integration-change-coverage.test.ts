import type { Id } from "../../../convex/_generated/dataModel"
import { mutation } from "../../../convex/integrationMutation"
import { testContext, invoke } from "./testing/database"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("actual bot event mutation appends all event summary invalidations", async () => {
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
        ["event-summaries", "match-summaries", "result-summaries"]
    )
})

test("assignment changes and identity relinks invalidate the exact Discord subjects, never imported IDs", async () => {
    const ctx = testContext()
    ctx.db.seed("users", {
        _id: "users:imported",
        id: "imported-player",
        discordId: "discord-before",
    })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:linked",
        serverId: "guild-a",
        userId: "imported-player",
        gameId: "wardogs",
        type: "member",
        status: "pending",
    })
    await invoke(
        mutation({
            args: {},
            handler: async (tracked) => {
                await tracked.db.patch(
                    "userAssignments:linked" as Id<"userAssignments">,
                    { status: "active" }
                )
            },
        }),
        ctx
    )
    assert.deepEqual(
        ctx.db.tables.integrationChanges.map((row) => row.id),
        ["discord-before"]
    )
    await invoke(
        mutation({
            args: {},
            handler: async (tracked) => {
                await tracked.db.patch("users:imported" as Id<"users">, {
                    discordId: "discord-after",
                })
            },
        }),
        ctx
    )
    assert.deepEqual(
        ctx.db.tables.integrationChanges.map((row) => row.id),
        ["discord-before", "discord-before", "discord-after"]
    )
    await invoke(
        mutation({
            args: {},
            handler: async (tracked) => {
                await tracked.db.patch("users:imported" as Id<"users">, {
                    discordId: undefined,
                })
            },
        }),
        ctx
    )
    assert.deepEqual(
        ctx.db.tables.integrationChanges.map((row) => row.id),
        ["discord-before", "discord-before", "discord-after", "discord-after"]
    )
})

test("creating a Discord profile invalidates its pre-existing legacy assignment", async () => {
    process.env.INTERNAL_AUTH_SECRET = "synthetic-sync-secret"
    const players = await import("../../../convex/players")
    const ctx = testContext()
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:legacy",
        serverId: "guild-a",
        userId: "discord-new",
        gameId: "wardogs",
        type: "member",
        status: "active",
    })
    await invoke(players.syncDiscordProfile, ctx, {
        secret: "synthetic-sync-secret",
        id: "discord-new",
        name: "Fixture",
        avatar: "",
    })
    assert.deepEqual(
        ctx.db.tables.integrationChanges?.map((row) => row.id),
        ["discord-new"]
    )
})

test("relinking to a legacy assignment alias invalidates the newly visible membership", async () => {
    const ctx = testContext()
    ctx.db.seed("users", { _id: "users:imported", id: "imported-player" })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:legacy",
        serverId: "guild-a",
        userId: "discord-new",
        gameId: "wardogs",
        type: "member",
        status: "active",
    })
    await invoke(
        mutation({
            args: {},
            handler: async (tracked) => {
                await tracked.db.patch("users:imported" as Id<"users">, {
                    discordId: "discord-new",
                })
            },
        }),
        ctx
    )
    assert.deepEqual(
        ctx.db.tables.integrationChanges?.map((row) => row.id),
        ["discord-new"]
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
    assert.equal(ctx.db.tables.integrationChanges.length, 3)
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
    assert.equal(ctx.db.tables.integrationChanges.length, 6)
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
    assert.equal(ctx.db.tables.integrationChanges.length, 9)
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
    assert.equal(ctx.db.tables.integrationChanges.length, 12)
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
        "eventResults",
        "publicApi",
        "migrations",
        "matchStats",
        "serverSetup",
        "competitions",
        "gameData",
        "gameDataHistory",
        "discordSync",
        "userAssignments",
        "groups",
        "players",
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
test("assignment create and removal advance the exact membership projection", async () => {
    process.env.INTERNAL_AUTH_SECRET = "synthetic-sync-secret"
    const assignments = await import("../../../convex/userAssignments")
    const ctx = testContext()
    ctx.db.seed("guilds", { _id: "guilds:one", discordId: "guild-a" })
    ctx.db.seed("users", { _id: "users:one", discordId: "member-a" })
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        secret: "synthetic-sync-secret",
        serverDiscordId: "guild-a",
        gameId: "wardogs",
        userId: "member-a",
        type: "member",
        status: "active",
        secondaryGroupIds: [],
        paused: false,
    })
    assert.deepEqual(
        ctx.db.tables.integrationChanges.map((row) => [
            row.guildId,
            row.gameId,
            row.resource,
            row.id,
            row.operation,
        ]),
        [["guild-a", "wardogs", "membership-summaries", "member-a", "upsert"]]
    )
    await invoke(assignments.remove, ctx, {
        secret: "synthetic-sync-secret",
        assignmentId: ctx.db.tables.userAssignments[0]._id,
    })
    assert.equal(ctx.db.tables.integrationChanges.length, 2)
    assert.equal(ctx.db.tables.integrationChanges[1].operation, "upsert")
})

for (const hasPrimaryAssignment of [false, true]) {
    test(`actual user merge invalidates ${hasPrimaryAssignment ? "deleted duplicate assignment" : "both reassigned subjects"} and event projections`, async () => {
        process.env.INTERNAL_AUTH_SECRET = "synthetic-sync-secret"
        const players = await import("../../../convex/players")
        const ctx = testContext()
        for (const discordId of ["primary", "secondary"])
            ctx.db.seed("users", {
                _id: `users:${discordId}`,
                discordId,
                name: discordId,
                avatar: "",
                managedGuildIds: [],
                mercenaryGuildIds: [],
            })
        const assignment = {
            serverId: "guild-a",
            gameId: "wardogs",
            type: "member",
            status: "active",
            secondaryGroupIds: [],
            paused: false,
        }
        ctx.db.seed("userAssignments", {
            _id: "userAssignments:secondary",
            userId: "secondary",
            ...assignment,
        })
        if (hasPrimaryAssignment)
            ctx.db.seed("userAssignments", {
                _id: "userAssignments:primary",
                userId: "primary",
                ...assignment,
            })
        ctx.db.seed("events", {
            _id: "events:merge",
            guildId: "guild-a",
            gameId: "wardogs",
            kind: "match",
            name: "Synthetic match",
            updatedAt: "2020-01-01T00:00:00Z",
            participants: [{ userId: "secondary" }],
        })
        await invoke(players.mergeUsers, ctx, {
            secret: "synthetic-sync-secret",
            primaryUserId: "primary",
            secondaryUserId: "secondary",
        })
        assert.equal(ctx.db.tables.userAssignments.length, 1)
        assert.equal(ctx.db.tables.userAssignments[0].userId, "primary")
        assert.equal(ctx.db.tables.events[0].participants[0].userId, "primary")
        const changes = ctx.db.tables.integrationChanges ?? []
        assert.deepEqual(
            changes
                .filter((row) => row.resource === "membership-summaries")
                .map((row) => row.id)
                .sort(),
            hasPrimaryAssignment ? ["secondary"] : ["primary", "secondary"]
        )
        assert.deepEqual(
            changes
                .filter((row) => row.id === "events:merge")
                .map((row) => row.resource)
                .sort(),
            ["event-summaries", "match-summaries", "result-summaries"]
        )
        assert.ok(
            changes.every(
                (row) =>
                    row.guildId === "guild-a" &&
                    row.gameId === "wardogs" &&
                    row.operation === "upsert"
            )
        )
        assert.equal(ctx.db.tables.integrationRecords.length, changes.length)
    })
}
