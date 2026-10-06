import { CLAN_META_INTERVAL_MS } from "../../domain/api/clan-meta"
import { invoke, spyReads, testContext } from "./testing/database"
import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"

/**
 * `/api/v1/clan/meta` over the fake database: the request's read
 * (`publicApiReads:getClanMeta`) touches the key, the clan, its enabled
 * games and the stored summary only, never the clan's events, rosters or
 * matches; the scan runs in `clanMeta:refreshClanMeta`, at most once per
 * interval (ARCHITECTURE.md, "Convex hot paths").
 */

const secret = ["synthetic", "clan", "meta", "secret"].join("-")
const NOW = Date.parse("2026-10-06T12:00:00.000Z")
const AT = "2026-01-01T00:00:00.000Z"

function fixture(t: TestContext) {
    process.env.INTERNAL_AUTH_SECRET = secret
    t.mock.timers.enable({ apis: ["Date"], now: NOW })
    const ctx = testContext()
    for (const [guildId, keyHash] of [
        ["guild-a", "hash-a"],
        ["guild-b", "hash-b"],
    ]) {
        ctx.db.seed("apiKeys", {
            _id: `apiKeys:${guildId}`,
            guildId,
            name: "website",
            keyHash,
            keyPrefix: "logi_",
            createdAt: AT,
        })
        ctx.db.seed("guilds", {
            _id: `guilds:${guildId}`,
            discordId: guildId,
            name: guildId,
            avatar: "",
            botInside: true,
            adminIds: [],
            memberIds: [],
            mercenaryIds: [],
            createdAt: AT,
            updatedAt: `2026-10-06T11:00:00.000Z`,
        })
    }
    for (const [guildId, gameId, enabled] of [
        ["guild-a", "wardogs", true],
        ["guild-a", "hell_let_loose", false],
        ["guild-b", "hell_let_loose", true],
    ] as const)
        ctx.db.seed("guildGames", {
            _id: `guildGames:${guildId}:${gameId}`,
            guildId,
            gameId,
            enabled,
            settingsVersion: 1,
            createdAt: AT,
            updatedAt: AT,
        })
    for (const [id, guildId, isDraft] of [
        ["one", "guild-a", false],
        ["two", "guild-a", false],
        ["draft", "guild-a", true],
        ["other", "guild-b", false],
    ] as const)
        ctx.db.seed("events", {
            _id: `events:${id}`,
            guildId,
            name: id,
            ...(isDraft ? { isDraft: true } : {}),
            registrationEnd: AT,
            meetingStart: AT,
            gameStart: AT,
            gameEnd: AT,
            signUps: [],
            participants: [],
            createdAt: AT,
            updatedAt: AT,
        })
    // Two rows for one event (the first wins) and one for the draft, which
    // the counts leave out with its event.
    for (const [id, eventId] of [
        ["one", "events:one"],
        ["one-duplicate", "events:one"],
        ["draft", "events:draft"],
        ["other", "events:other"],
    ])
        ctx.db.seed("rosters", {
            _id: `rosters:${id}`,
            eventId,
            squads: [],
            reservePlayerIds: [],
            notAttendingPlayerIds: [],
            published: false,
            createdAt: AT,
            updatedAt: AT,
        })
    for (const [id, guildId, userId, gameId] of [
        ["a1", "guild-a", "user-1", "wardogs"],
        ["a1h", "guild-a", "user-1", "hell_let_loose"],
        ["a2", "guild-a", "user-2", "wardogs"],
        ["b3", "guild-b", "user-3", "hell_let_loose"],
    ])
        ctx.db.seed("userAssignments", {
            _id: `userAssignments:${id}`,
            userId,
            serverId: guildId,
            gameId,
            type: "member",
            status: "active",
            paused: false,
            createdAt: AT,
            updatedAt: AT,
        })
    ctx.db.seed("matchStats", {
        _id: "matchStats:one",
        guildId: "guild-a",
        eventId: "events:one",
        gameId: "wardogs",
        matchId: "m1",
        raw: {},
    })
    for (const table of ["groups", "calendarItems", "stratmaps"])
        ctx.db.seed(table, {
            _id: `${table}:a`,
            guildId: "guild-a",
            name: table,
        })
    return ctx
}

const tablesOf = (calls: ReturnType<typeof spyReads>) =>
    [...new Set(calls.map((call) => call.table))].sort()
const indexesOf = (calls: ReturnType<typeof spyReads>, table: string) => [
    ...new Set(
        calls.filter((call) => call.table === table).map((call) => call.index)
    ),
]

const expectedCounts = {
    events: 2,
    groups: 1,
    rosters: 1,
    assignments: 3,
    users: 2,
    "calendar-items": 1,
    stratmaps: 1,
    "topic-presets": 0,
    "squad-presets": 0,
    matches: 1,
    articles: 0,
    settings: 1,
    "api-keys": 1,
}

test("the meta read serves the stored summary and touches no events, rosters or matches", async (t) => {
    const reads = await import("../../../convex/publicApiReads")
    const ctx = fixture(t)
    ctx.db.seed("clanMetaSummaries", {
        _id: "clanMetaSummaries:a",
        guildId: "guild-a",
        tallies: {
            events: 7,
            groups: 1,
            rosters: 4,
            assignments: 3,
            users: 2,
            calendarItems: 1,
            stratmaps: 1,
            topicPresets: 0,
            squadPresets: 0,
            matches: 1,
            articles: 0,
            apiKeys: 1,
        },
        computedAt: "2026-10-06T11:59:30.000Z",
        revision: 3,
    })
    const calls = spyReads(ctx)
    const meta = await invoke(reads.getClanMeta, ctx, {
        secret,
        keyHash: "hash-a",
    })
    assert.deepEqual(meta, {
        guild: { id: "guilds:guild-a", guildId: "guild-a", name: "guild-a" },
        enabledGames: ["wardogs"],
        counts: { ...expectedCounts, events: 7, rosters: 4 },
        computedAt: "2026-10-06T11:59:30.000Z",
        updatedAt: "2026-10-06T11:00:00.000Z",
    })
    assert.deepEqual(tablesOf(calls), [
        "apiKeys",
        "clanMetaSummaries",
        "guildGames",
        "guilds",
    ])
    assert.deepEqual(indexesOf(calls, "guildGames"), ["guildId_gameId"])
    assert.deepEqual(indexesOf(calls, "clanMetaSummaries"), ["guildId"])
})

test("a clan without a summary reads with null counts, still without a scan", async (t) => {
    const reads = await import("../../../convex/publicApiReads")
    const ctx = fixture(t)
    const calls = spyReads(ctx)
    const meta = await invoke(reads.getClanMeta, ctx, {
        secret,
        keyHash: "hash-b",
    })
    assert.equal(meta.counts, null)
    assert.equal(meta.computedAt, null)
    assert.deepEqual(meta.enabledGames, ["hell_let_loose"])
    assert.equal(meta.updatedAt, "2026-10-06T11:00:00.000Z")
    assert.ok(!tablesOf(calls).includes("events"))
    await assert.rejects(
        invoke(reads.getClanMeta, ctx, { secret: "wrong", keyHash: "hash-b" })
    )
})

test("the refresh scans the clan through its indexes once per interval and the read serves the result", async (t) => {
    const clanMeta = await import("../../../convex/clanMeta")
    const reads = await import("../../../convex/publicApiReads")
    const ctx = fixture(t)
    const calls = spyReads(ctx)
    const first = await invoke(clanMeta.refreshClanMeta, ctx, {
        secret,
        keyHash: "hash-a",
    })
    assert.deepEqual(first, {
        counts: expectedCounts,
        computedAt: new Date(NOW).toISOString(),
    })
    assert.deepEqual(indexesOf(calls, "events"), ["guildId"])
    assert.deepEqual(indexesOf(calls, "rosters"), ["eventId"])
    assert.deepEqual(indexesOf(calls, "userAssignments"), ["serverId"])
    assert.deepEqual(indexesOf(calls, "matchStats"), ["guildId"])
    assert.ok(!tablesOf(calls).includes("users"))
    assert.ok(!tablesOf(calls).includes("guildGames"))
    const stored = () => ctx.db.tables.clanMetaSummaries
    assert.equal(stored().length, 1)
    assert.equal(stored()[0].revision, 1)

    // Within the interval a second call serves the stored summary and
    // writes nothing, whatever changed since.
    ctx.db.seed("groups", { _id: "groups:b", guildId: "guild-a", name: "b" })
    t.mock.timers.tick(CLAN_META_INTERVAL_MS - 1)
    const second = await invoke(clanMeta.refreshClanMeta, ctx, {
        secret,
        keyHash: "hash-a",
    })
    assert.deepEqual(second, first)
    assert.equal(stored()[0].revision, 1)

    // From the interval on it recomputes and bumps the revision.
    t.mock.timers.tick(1)
    const third = await invoke(clanMeta.refreshClanMeta, ctx, {
        secret,
        keyHash: "hash-a",
    })
    assert.equal(third.counts.groups, 2)
    assert.equal(
        third.computedAt,
        new Date(NOW + CLAN_META_INTERVAL_MS).toISOString()
    )
    assert.equal(stored().length, 1)
    assert.equal(stored()[0].revision, 2)

    const meta = await invoke(reads.getClanMeta, ctx, {
        secret,
        keyHash: "hash-a",
    })
    assert.deepEqual(meta.counts, third.counts)
    assert.equal(meta.computedAt, third.computedAt)
})

test("the refresh rejects the wrong secret and keys the read would reject", async (t) => {
    const clanMeta = await import("../../../convex/clanMeta")
    const ctx = fixture(t)
    await assert.rejects(
        invoke(clanMeta.refreshClanMeta, ctx, {
            secret: "wrong",
            keyHash: "hash-a",
        })
    )
    assert.equal(
        await invoke(clanMeta.refreshClanMeta, ctx, {
            secret,
            keyHash: "unknown",
        }),
        null
    )
    await ctx.db.patch("apiKeys:guild-a", { revokedAt: AT })
    assert.equal(
        await invoke(clanMeta.refreshClanMeta, ctx, {
            secret,
            keyHash: "hash-a",
        }),
        null
    )
    await ctx.db.patch("apiKeys:guild-b", {
        readAccess: { resources: ["events"], gameIds: ["hell_let_loose"] },
    })
    assert.equal(
        await invoke(clanMeta.refreshClanMeta, ctx, {
            secret,
            keyHash: "hash-b",
        }),
        null
    )
    assert.equal(ctx.db.tables.clanMetaSummaries, undefined)
})
