import assert from "node:assert/strict"
import test from "node:test"

import * as serverDashboard from "../../../convex/serverDashboard"
import { invoke, testContext } from "./testing/database"

const secret = (process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret")

test("the dashboard summary scopes Wardogs and keeps all faction scores", async () => {
    const ctx = testContext()
    ctx.db.seed("guilds", {
        _id: "guilds:one",
        id: "guild",
        discordId: "guild",
        name: "Valkyria",
        memberIds: [],
        adminIds: [],
        mercenaryIds: [],
    })
    ctx.db.seed("events", {
        _id: "events:wardogs",
        guildId: "guild",
        gameId: "wardogs",
        kind: "match",
        name: "Wardogs final",
        side: "Manticore",
        gameEnd: "2026-10-10T20:00:00Z",
        wardogsReportId: "wardogsMatchReports:one",
        reviewedResult: {
            status: "confirmed",
            reviewedAt: "2026-10-10T20:30:00Z",
            participants: [
                { id: "valkyra", label: "Valkyra", score: 100 },
                { id: "manticore", label: "Manticore", score: 91 },
                { id: "lonestar", label: "Lonestar", score: 65 },
            ],
        },
    })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:one",
        userId: "user",
        serverId: "guild",
        gameId: "wardogs",
    })
    ctx.db.seed("playerStats", {
        _id: "playerStats:one",
        id: "wardogs:guild:steam:one",
        userId: "user",
        latestName: "Kardy",
        matches: {
            "events:wardogs": { kills: 12, deaths: 6 },
        },
    })
    ctx.db.seed("users", {
        _id: "users:one",
        id: "user",
        name: "Kardy",
        avatar: "",
        platformIds: [],
        managedGuildIds: [],
        mercenaryGuildIds: [],
        isStreamer: false,
        updatedAt: "2026-10-10T20:00:00Z",
    })

    const result = await invoke(
        serverDashboard.getRecentMatchSummaryInternal,
        ctx,
        {
            secret,
            serverId: "guilds:one",
            gameScope: "wardogs",
        }
    )

    assert.deepEqual(result?.recentMatches[0]?.scores, [100, 91, 65])
    assert.equal(result?.recentMatches[0]?.outcome, "defeat")
    assert.deepEqual(result?.topPlayers[0], {
        id: "user",
        name: "Kardy",
        matches: 1,
        kills: 12,
        deaths: 6,
        roles: [],
    })
})

test("the dashboard summary does not leak HLL results into Wardogs", async () => {
    const ctx = testContext()
    ctx.db.seed("guilds", {
        _id: "guilds:one",
        id: "guild",
        discordId: "guild",
        name: "Valkyria",
        memberIds: [],
        adminIds: [],
        mercenaryIds: [],
    })
    ctx.db.seed("events", {
        _id: "events:hll",
        guildId: "guild",
        gameId: "hell_let_loose",
        kind: "match",
        name: "HLL match",
        gameEnd: "2026-10-09T20:00:00Z",
        matchStatsId: "matchStats:one",
        eventResult: {
            endedAt: "2026-10-09T20:00:00Z",
            outcome: "victory",
            score: { sideA: 5, sideB: 2 },
        },
    })
    const result = await invoke(
        serverDashboard.getRecentMatchSummaryInternal,
        ctx,
        {
            secret,
            serverId: "guilds:one",
            gameScope: "wardogs",
        }
    )
    assert.deepEqual(result?.recentMatches, [])
})

test("score-only results count without manufacturing player statistics", async () => {
    const ctx = testContext()
    ctx.db.seed("guilds", {
        _id: "guilds:one",
        id: "guild",
        discordId: "guild",
        name: "Clan",
        memberIds: [],
        adminIds: [],
        mercenaryIds: [],
    })
    const base = {
        guildId: "guild",
        gameId: "hell_let_loose",
        kind: "match",
        name: "Manual result",
        side: "Allies",
        gameEnd: "2026-10-10T20:00:00Z",
    }
    const reviewedResult = {
        status: "confirmed",
        reviewedAt: "2026-10-11T20:00:00Z",
        participants: [
            { id: "axis", label: "Axis", score: 2 },
            { id: "allies", label: "Allies", score: 3 },
        ],
    }
    ctx.db.seed("events", { ...base, _id: "events:manual", reviewedResult })
    ctx.db.seed("events", {
        ...base,
        _id: "events:legacy",
        eventResult: {
            outcome: "defeat",
            score: { sideA: 4, sideB: 1 },
            endedAt: base.gameEnd,
        },
    })
    ctx.db.seed("events", {
        ...base,
        _id: "events:corrected",
        reviewedResult: {
            ...reviewedResult,
            status: "corrected",
        },
        eventResult: { outcome: "defeat", score: { sideA: 4, sideB: 1 } },
    })
    for (const [id, overrides] of Object.entries({
        draft: { isDraft: true, reviewedResult },
        training: { kind: "training", reviewedResult },
        pending: {
            reviewedResult: { ...reviewedResult, status: "provisional" },
        },
        unknown: {},
        otherClan: { guildId: "other", reviewedResult },
        otherGame: { gameId: "wardogs", reviewedResult },
    }))
        ctx.db.seed("events", { ...base, _id: `events:${id}`, ...overrides })
    const result = await invoke(
        serverDashboard.getRecentMatchSummaryInternal,
        ctx,
        {
            secret,
            serverId: "guilds:one",
            gameScope: "hell_let_loose",
        }
    )
    assert.equal(result?.recentMatches.length, 3)
    assert.equal(result?.wins, 2)
    assert.equal(result?.losses, 1)
    assert.equal(result?.winRate, 2 / 3)
    assert.deepEqual(result?.topPlayers, [])
    assert.deepEqual(
        result?.recentMatches.find(
            (match: { id: string; scores: number[] }) =>
                match.id === "events:corrected"
        )?.scores,
        [2, 3]
    )
})

test("manual team results work before faction assignment and are recomputed after edits", async () => {
    const ctx = testContext()
    ctx.db.seed("guilds", {
        _id: "guilds:one",
        id: "guild",
        discordId: "guild",
        name: "Valkyria",
    })
    ctx.db.seed("teamDirectory", {
        _id: "teamDirectory:vlk",
        gameId: "wardogs",
        linkedGuildId: "guild",
        name: "Valkyria",
        shortCode: "VLK",
    })
    ctx.db.seed("events", {
        _id: "events:manual",
        guildId: "guild",
        gameId: "wardogs",
        kind: "match",
        name: "VLK vs BMF vs ROG",
        gameEnd: "2026-10-28T20:00:00Z",
        matchTeams: [
            {
                teamId: "teamDirectory:vlk",
                slot: "a",
                side: null,
                snapshot: { name: "Valkyria", shortCode: "VLK", logoUrl: null },
            },
        ],
        reviewedResult: {
            status: "confirmed",
            reviewedAt: "2026-10-28T20:30:00Z",
            participants: [
                { id: "manual-b", label: "BeMyFrag", score: 52 },
                { id: "manual-c", label: "TEAM ROGUE", score: 64 },
                { id: "manual-a", label: "Valkyria", score: 100 },
            ],
        },
    })
    const read = () =>
        invoke(serverDashboard.getRecentMatchSummaryInternal, ctx, {
            secret,
            serverId: "guilds:one",
            gameScope: "wardogs",
        })
    assert.equal((await read())?.recentMatches[0]?.outcome, "victory")
    const event = await ctx.db.get("events:manual")
    await ctx.db.patch("events:manual", {
        side: "Valkyra",
        matchTeams: event!.matchTeams.map((team: { side: string | null }) => ({
            ...team,
            side: "Valkyra",
        })),
    })
    assert.equal((await read())?.recentMatches[0]?.outcome, "victory")
    assert.equal((await read())?.wins, 1)
    assert.equal((await read())?.losses, 0)
})

test("an unidentified clan is unknown rather than a fabricated draw", async () => {
    const ctx = testContext()
    ctx.db.seed("guilds", {
        _id: "guilds:one",
        id: "guild",
        discordId: "guild",
        name: "Unknown clan",
    })
    ctx.db.seed("events", {
        _id: "events:manual",
        guildId: "guild",
        gameId: "wardogs",
        kind: "match",
        name: "Manual match",
        gameEnd: "2026-10-28T20:00:00Z",
        reviewedResult: {
            status: "confirmed",
            reviewedAt: "2026-10-28T20:30:00Z",
            participants: [
                { id: "a", label: "Valkyria", score: 100 },
                { id: "b", label: "BeMyFrag", score: 52 },
                { id: "c", label: "TEAM ROGUE", score: 64 },
            ],
        },
    })
    const summary = await invoke(
        serverDashboard.getRecentMatchSummaryInternal,
        ctx,
        { secret, serverId: "guilds:one", gameScope: "wardogs" }
    )
    assert.equal(summary?.recentMatches[0]?.outcome, null)
    assert.equal(summary?.wins, 0)
    assert.equal(summary?.losses, 0)
})
