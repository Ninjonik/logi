import assert from "node:assert/strict"
import test from "node:test"

import { getFunctionName } from "convex/server"

import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import * as history from "../../../convex/performanceHistory"
import { invoke, testContext } from "./testing/database"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET
const guildId = "guild-a"
const gameId = "hell_let_loose"

/** A workspace with two matches; a and b played the first, c only the second. */
function fixture() {
    const ctx = testContext()
    seedDashboardActor(ctx.db, guildId)
    for (const userId of ["user-a", "user-b", "user-c"])
        ctx.db.seed("userAssignments", {
            _id: `userAssignments:${userId}`,
            serverId: guildId,
            userId,
            gameId,
        })
    const match = (eventId: string, players: string[], end: string) => {
        ctx.db.seed("events", {
            _id: `events:${eventId}`,
            guildId,
            gameId,
            kind: "match",
            name: eventId,
            gameEnd: end,
            matchStatsId: `matchStats:${eventId}`,
        })
        ctx.db.seed("matchStats", {
            _id: `matchStats:${eventId}`,
            guildId,
            gameId,
            eventId: `events:${eventId}`,
            raw: {
                result: { axis: 3, allied: 2 },
                player_stats: players.map((player) => ({
                    player_id: player,
                    combat: 10,
                    offense: 5,
                    support: 7,
                    kills: 4,
                    deaths: 2,
                    team: { side: "allies" },
                })),
            },
        })
    }
    match("one", ["steam-a", "steam-b", "steam-x"], "2026-10-01T20:00:00.000Z")
    match("two", ["steam-c"], "2026-10-02T20:00:00.000Z")
    const stats = (id: string, userId: string | undefined, events: string[]) =>
        ctx.db.seed("playerStats", {
            _id: `playerStats:${id}`,
            id,
            userId,
            updatedAt: "2026-10-02T21:00:00.000Z",
            matches: Object.fromEntries(
                events.map((eventId) => [
                    `events:${eventId}`,
                    {
                        sourceUrl: "https://crcon.example/games/1",
                        importedAt: "2026-10-02T21:00:00.000Z",
                        mapId: "foy",
                        playerName: id,
                        team: "allies",
                        kills: 4,
                        killDeathRatio: 2,
                        deaths: 2,
                        offense: 5,
                        defense: 1,
                        support: 7,
                    },
                ])
            ),
        })
    stats("steam-a", "user-a", ["one"])
    stats("steam-b", "user-b", ["one"])
    stats("steam-c", "user-c", ["two"])
    // A linked player who is not assigned in this workspace.
    stats("steam-x", "user-elsewhere", ["one"])
    const writes: string[] = []
    const patch = ctx.db.patch.bind(ctx.db)
    const insert = ctx.db.insert.bind(ctx.db)
    ctx.db.patch = async (id, value) => {
        writes.push(id.split(":")[0]!)
        return await patch(id, value)
    }
    ctx.db.insert = async (table, value) => {
        writes.push(table)
        return await insert(table, value)
    }
    return { ctx, writes }
}

/** Runs an action with `runQuery`/`runMutation` dispatched to the handlers. */
function actionContext(ctx: ReturnType<typeof testContext>) {
    const functions: Record<string, unknown> = {
        "performanceHistory:refreshGuildOnly": history.refreshGuildOnly,
        "performanceHistory:refreshPlayerForGuild":
            history.refreshPlayerForGuild,
        "performanceHistory:listClanUserIds": history.listClanUserIds,
        "performanceHistory:matchClanUserIds": history.matchClanUserIds,
        "performanceHistory:authorizeRefresh": history.authorizeRefresh,
    }
    const called: string[] = []
    const run = (
        ref: Parameters<typeof getFunctionName>[0],
        args: Record<string, unknown>
    ) => {
        const name = getFunctionName(ref)
        called.push(
            name === "performanceHistory:refreshPlayerForGuild"
                ? `${name}:${String(args.userId)}`
                : name
        )
        return invoke(functions[name], ctx, args)
    }
    return { actionCtx: { runQuery: run, runMutation: run }, called }
}
const runAction = (
    fn: unknown,
    actionCtx: unknown,
    args: Record<string, unknown>
) =>
    (
        fn as {
            _handler: (
                ctx: unknown,
                args: Record<string, unknown>
            ) => Promise<{ guildMatches: number; players: number }>
        }
    )._handler(actionCtx, args)

test("a history whose matches did not change is not written again", async () => {
    const { ctx, writes } = fixture()
    await invoke(history.refreshGuildOnly, ctx, { secret, guildId, gameId })
    assert.deepEqual(writes, ["guildPerformanceHistory"])
    await invoke(history.refreshPlayerForGuild, ctx, {
        secret,
        guildId,
        gameId,
        userId: "user-a",
    })
    assert.deepEqual(writes, [
        "guildPerformanceHistory",
        "playerPerformanceHistory",
    ])
    writes.length = 0
    await invoke(history.refreshGuildOnly, ctx, { secret, guildId, gameId })
    await invoke(history.refreshPlayerForGuild, ctx, {
        secret,
        guildId,
        gameId,
        userId: "user-a",
    })
    assert.deepEqual(writes, [], "a second refresh changes nothing")
    // A renamed match changes the stored labels: one write each.
    await ctx.db.patch("events:one", { name: "Vlci vs Rogue" })
    writes.length = 0
    await invoke(history.refreshGuildOnly, ctx, { secret, guildId, gameId })
    await invoke(history.refreshPlayerForGuild, ctx, {
        secret,
        guildId,
        gameId,
        userId: "user-a",
    })
    assert.deepEqual(writes, [
        "guildPerformanceHistory",
        "playerPerformanceHistory",
    ])
})

test("an imported match refreshes the workspace and only the members who played it", async () => {
    const { ctx } = fixture()
    assert.deepEqual(
        await invoke(history.matchClanUserIds, ctx, {
            guildId,
            eventId: "events:one",
        }),
        ["user-a", "user-b"]
    )
    assert.deepEqual(
        await invoke(history.matchClanUserIds, ctx, {
            guildId: "guild-b",
            eventId: "events:one",
        }),
        [],
        "another workspace's match names nobody"
    )
    const { actionCtx, called } = actionContext(ctx)
    const result = await runAction(history.refreshInBackground, actionCtx, {
        secret,
        guildId,
        gameId,
        eventId: "events:one",
    })
    assert.deepEqual(called, [
        "performanceHistory:matchClanUserIds",
        "performanceHistory:refreshGuildOnly",
        "performanceHistory:refreshPlayerForGuild:user-a",
        "performanceHistory:refreshPlayerForGuild:user-b",
    ])
    assert.equal(result.players, 2)
    assert.deepEqual(
        ctx.db.tables.playerPerformanceHistory.map((row) => row.userId),
        ["user-a", "user-b"]
    )
})

test("the dashboard refresh checks the clan admin before it reads anything, then rebuilds every member", async () => {
    const { ctx, writes } = fixture()
    const { actionCtx, called } = actionContext(ctx)
    ctx.db.tables.discordMemberAccess![0]!.isAdmin = false
    ctx.db.tables.discordMemberAccess![0]!.hasDashboardAccess = false
    await assert.rejects(
        runAction(history.refreshForDashboard, actionCtx, {
            secret,
            guildId,
            gameId,
            actor: actorFixture,
        }),
        /Forbidden/
    )
    await assert.rejects(
        runAction(history.refreshForDashboard, actionCtx, {
            secret: "wrong",
            guildId,
            gameId,
            actor: actorFixture,
        }),
        /Unauthorized/
    )
    assert.deepEqual(called, ["performanceHistory:authorizeRefresh"])
    assert.deepEqual(writes, [])
    ctx.db.tables.discordMemberAccess![0]!.isAdmin = true
    const result = await runAction(history.refreshForDashboard, actionCtx, {
        secret,
        guildId,
        gameId,
        actor: actorFixture,
    })
    assert.deepEqual(result, { guildMatches: 2, players: 3 })
    assert.equal(ctx.db.tables.playerPerformanceHistory.length, 3)
})
