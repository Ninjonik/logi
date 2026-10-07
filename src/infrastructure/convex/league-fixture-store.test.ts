import {
    admitIndex,
    claimFixture,
    finishFixture,
    markReparse,
    pruneFixtures,
    status,
} from "../../../convex/leagueDiscoveryFixtures"
import {
    completedLeagueSnapshot,
    leagueReadOf,
    leagueSnapshotFixture,
} from "../testing/league-fixtures"
import type { LeagueSnapshot } from "../../domain/wardogs-league/contracts"
import { leagueOverviewSchema } from "../../domain/wardogs-league/panels"
import { NEVER } from "../../domain/wardogs-league/all-fixtures"
import { forGuild } from "../../../convex/leagueDiscoveryPanels"
import { overview } from "../../../convex/leagueFixtureReads"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET
const guildId = "guild-a"
const url = (id: string) => `https://wardogsleague.net/matches/${id}`
const iso = (offset: number) => new Date(Date.now() + offset).toISOString()
const DAY = 86_400_000

function context(fixtureIds: string[], resultIds: string[], fetchedAt = 1) {
    const ctx = testContext()
    ctx.db.seed("leagueIndexCache", {
        _id: "leagueIndexCache:indexes",
        key: "indexes",
        matchUrls: [...fixtureIds, ...resultIds].map(url),
        fixtureUrls: fixtureIds.map(url),
        resultUrls: resultIds.map(url),
        incomplete: false,
        fetchedAt,
        nextScanAt: 0,
        leaseUntil: 0,
        fence: 0,
    })
    ctx.db.seed("leagueTrackingSettings", {
        _id: "leagueTrackingSettings:1",
        guildId,
        enabled: true,
        teamCodes: ["VLK"],
        inputChannelId: null,
        outputChannelId: null,
        revision: 1,
    })
    return ctx
}
const upcomingPage = (id: string, extra: Partial<LeagueSnapshot> = {}) =>
    leagueSnapshotFixture({
        id,
        sourceUrl: url(id),
        scheduledAt: iso(DAY),
        fetchedAt: iso(0),
        ...extra,
    })
const finishedPage = (id: string, fixtureNumber: number) =>
    completedLeagueSnapshot({
        id,
        fixtureNumber,
        scheduledAt: iso(-DAY),
        podium: ["ROG", "VLK", "DEF"],
        fetchedAt: iso(0),
    })
async function readNext(
    ctx: ReturnType<typeof testContext>,
    pages: Record<string, LeagueSnapshot | null>
) {
    const claim = await invoke(claimFixture, ctx, { secret })
    if (!claim) return null
    const page = pages[claim.matchId] ?? null
    return {
        claim,
        stored: await invoke(finishFixture, ctx, {
            secret,
            id: claim.id,
            fence: claim.fence,
            readJson: JSON.stringify(
                leagueReadOf(page, Date.now(), page ? null : "network")
            ),
            resultsParser: "none/1",
        }),
    }
}

test("every function requires the internal secret", async () => {
    const ctx = context(["up"], [])
    for (const [fn, args] of [
        [status, {}],
        [admitIndex, {}],
        [pruneFixtures, {}],
        [markReparse, { resultsParser: "x" }],
        [claimFixture, {}],
        [forGuild, { guildId }],
        [overview, { keyHash: "hash", guildId, limit: 6 }],
    ] as const)
        await assert.rejects(
            invoke(fn, ctx, { ...args, secret: "wrong" }),
            /Unauthorized/
        )
})

test("collection runs only while Wardogs League is enabled somewhere", async () => {
    const ctx = context([], [])
    assert.deepEqual(await invoke(status, ctx, { secret }), { wanted: true })
    ctx.db.tables.leagueTrackingSettings[0].enabled = false
    assert.deepEqual(await invoke(status, ctx, { secret }), { wanted: false })
})

test("the shared index is admitted once; a match moving to results is retabbed and read soon", async () => {
    const ctx = context(["up", "moving"], ["done"])
    assert.deepEqual(await invoke(admitIndex, ctx, { secret }), {
        added: 3,
        retabbed: 0,
        skipped: 0,
    })
    assert.deepEqual(await invoke(admitIndex, ctx, { secret }), {
        added: 0,
        retabbed: 0,
        skipped: 0,
    })
    const rows = ctx.db.tables.leagueFixtures
    assert.deepEqual(
        rows.map((row) => [row.matchId, row.tab, row.phase]),
        [
            ["up", "fixtures", "upcoming"],
            ["moving", "fixtures", "upcoming"],
            ["done", "results", "completed"],
        ]
    )
    rows[1].nextRefreshAt = NEVER
    Object.assign(ctx.db.tables.leagueIndexCache[0], {
        fetchedAt: 2,
        fixtureUrls: [url("up")],
        resultUrls: [url("moving"), url("done")],
    })
    assert.deepEqual(await invoke(admitIndex, ctx, { secret }), {
        added: 0,
        retabbed: 1,
        skipped: 0,
    })
    assert.equal(rows[1].tab, "results")
    assert.equal(rows[1].phase, "completed")
    assert.ok(rows[1].nextRefreshAt <= Date.now())
    assert.equal(ctx.db.tables.leagueCollectionState[0].fixturesRevision, 4)
})

test("reads are fenced, upcoming first; results feed the table and revisions", async () => {
    const ctx = context(["up"], ["done"])
    await invoke(admitIndex, ctx, { secret })
    const pages = { up: upcomingPage("up"), done: finishedPage("done", 37) }
    const first = await readNext(ctx, pages)
    assert.equal(first?.claim.matchId, "up")
    assert.equal(first?.stored, true)
    const second = await readNext(ctx, pages)
    assert.equal(second?.claim.matchId, "done")
    assert.equal(await readNext(ctx, pages), null)
    const [up, done] = ctx.db.tables.leagueFixtures
    assert.equal(up.phase, "upcoming")
    assert.equal(up.resultsParser, "none/1")
    assert.equal(up.scheduledAt, Date.parse(pages.up.scheduledAt!))
    assert.equal(done.hasResult, true)
    assert.equal(ctx.db.tables.leagueResults.length, 1)
    assert.deepEqual(
        ctx.db.tables.leagueResults[0].placements.map(
            (p: { teamCode: string }) => p.teamCode
        ),
        ["ROG", "VLK", "DEF"]
    )
    assert.equal(ctx.db.tables.leagueCollectionState[0].resultsRevision, 1)
    // A stale fence or a page of another match is refused.
    up.nextRefreshAt = 0
    const claim = await invoke(claimFixture, ctx, { secret })
    assert.equal(
        await invoke(finishFixture, ctx, {
            secret,
            id: claim.id,
            fence: claim.fence - 1,
            readJson: JSON.stringify(leagueReadOf(pages.up, Date.now())),
            resultsParser: "none/1",
        }),
        false
    )
    await assert.rejects(
        invoke(finishFixture, ctx, {
            secret,
            id: claim.id,
            fence: claim.fence,
            readJson: JSON.stringify(
                leagueReadOf(upcomingPage("other"), Date.now())
            ),
            resultsParser: "none/1",
        }),
        /Unexpected match/
    )
})

test("a failed read keeps the stored page and retries after a minute", async () => {
    const ctx = context(["up"], [])
    await invoke(admitIndex, ctx, { secret })
    await readNext(ctx, { up: upcomingPage("up") })
    const row = ctx.db.tables.leagueFixtures[0]
    const stored = row.snapshotJson
    row.nextRefreshAt = 0
    await readNext(ctx, { up: null })
    assert.equal(row.snapshotJson, stored)
    assert.equal(row.error, "network")
    assert.ok(row.nextRefreshAt >= Date.now() + 55_000)
})

test("the panels query: fixtures ship, the table waits, then fills from results; our team is marked", async () => {
    const ctx = context(["up"], ["done"])
    await invoke(admitIndex, ctx, { secret })
    await readNext(ctx, { up: upcomingPage("up") })
    let panels = await invoke(forGuild, ctx, { secret, guildId })
    assert.equal(panels.standings.state, "waiting_for_results")
    assert.deepEqual(
        panels.fixtures.fixtures.map((f: { matchId: string }) => f.matchId),
        ["up"]
    )
    assert.equal(panels.fixtures.fixtures[0].ours, true)
    await readNext(ctx, { done: finishedPage("done", 37) })
    panels = await invoke(forGuild, ctx, { secret, guildId })
    assert.equal(panels.standings.state, "ready")
    assert.deepEqual(
        panels.standings.rows.map((r: { teamCode: string; ours: boolean }) => [
            r.teamCode,
            r.ours,
        ]),
        [
            ["ROG", false],
            ["VLK", true],
            ["DEF", false],
        ]
    )
    assert.equal(panels.fixtures.recentResults.items[0].fixtureNumber, 37)
    const none = await invoke(forGuild, ctx, {
        secret,
        guildId,
        options: {
            table: false,
            fixtures: false,
            recentResults: false,
            fixtureCount: 6,
        },
    })
    assert.deepEqual(none, {
        enabled: true,
        standings: null,
        fixtures: null,
    })
    await assert.rejects(
        invoke(forGuild, ctx, {
            secret,
            guildId,
            options: {
                table: true,
                fixtures: true,
                recentResults: true,
                fixtureCount: 50,
            },
        })
    )
    // Another guild sees the same League without a highlighted team.
    const other = await invoke(forGuild, ctx, { secret, guildId: "guild-b" })
    assert.equal(other.fixtures.fixtures[0].ours, false)
})

test("the website overview needs a live league-fixtures grant of this guild and a bounded limit", async () => {
    const ctx = context(["up"], [])
    await invoke(admitIndex, ctx, { secret })
    await readNext(ctx, { up: upcomingPage("up") })
    const key = {
        _id: "apiKeys:1",
        guildId,
        keyHash: "hash",
        readAccess: { resources: ["league-fixtures"], gameIds: ["wardogs"] },
    }
    ctx.db.seed("apiKeys", key)
    const args = { secret, keyHash: "hash", guildId, limit: 6 }
    const data = await invoke(overview, ctx, args)
    assert.ok(leagueOverviewSchema.parse(data))
    assert.equal(data.standings.state, "waiting_for_results")
    assert.equal(data.fixtures.fixtures[0].matchId, "up")
    await assert.rejects(invoke(overview, ctx, { ...args, limit: 11 }))
    await assert.rejects(invoke(overview, ctx, { ...args, limit: 1.5 }))
    assert.equal(
        await invoke(overview, ctx, { ...args, guildId: "guild-b" }),
        null
    )
    ctx.db.tables.apiKeys[0].readAccess = {
        resources: ["league-matches"],
        gameIds: ["wardogs"],
    }
    assert.equal(await invoke(overview, ctx, args), null)
    ctx.db.tables.apiKeys[0].readAccess = key.readAccess
    ctx.db.tables.apiKeys[0].revokedAt = 1
    assert.equal(await invoke(overview, ctx, args), null)
})

test("a new results parser re-reads finished pages without placements once", async () => {
    const ctx = context([], ["done"])
    await invoke(admitIndex, ctx, { secret })
    await readNext(ctx, {
        done: upcomingPage("done", {
            status: "Completed",
            scheduledAt: iso(-20 * DAY),
        }),
    })
    const row = ctx.db.tables.leagueFixtures[0]
    assert.equal(row.phase, "completed")
    assert.equal(row.hasResult, false)
    assert.equal(row.nextRefreshAt, NEVER)
    assert.deepEqual(
        await invoke(markReparse, ctx, { secret, resultsParser: "none/1" }),
        { marked: 0 }
    )
    assert.deepEqual(
        await invoke(markReparse, ctx, { secret, resultsParser: "html/2" }),
        { marked: 1 }
    )
    assert.ok(row.nextRefreshAt <= Date.now())
})

test("pruning drops old unlisted fixtures and results before the previous season", async () => {
    const ctx = context([], [])
    const base = {
        firstSeenAt: Date.now() - 60 * DAY,
        tab: "results",
        phase: "completed",
        hasResult: false,
        changes: [],
        nextRefreshAt: NEVER,
        leaseUntil: 0,
        fence: 0,
        revision: 1,
        scheduledAt: Date.now() - 40 * DAY,
    }
    ctx.db.seed("leagueFixtures", {
        ...base,
        _id: "leagueFixtures:old",
        matchId: "old",
        listed: false,
    })
    ctx.db.seed("leagueFixtures", {
        ...base,
        _id: "leagueFixtures:listed",
        matchId: "listed",
        listed: true,
    })
    const result = {
        sourceUrl: url("r"),
        fixtureNumber: 1,
        type: "League",
        pointsRule: [3, 2, 1],
        pointsRuleSource: "published",
        confirmed: true,
        placements: [],
        revision: 1,
    }
    ctx.db.seed("leagueResults", {
        ...result,
        _id: "leagueResults:ancient",
        matchId: "ancient",
        season: "2000",
        occurredAt: Date.parse("2000-06-01T00:00:00.000Z"),
    })
    ctx.db.seed("leagueResults", {
        ...result,
        _id: "leagueResults:current",
        matchId: "current",
        season: new Date().getUTCFullYear().toString(),
        occurredAt: Date.now() - DAY,
    })
    assert.deepEqual(await invoke(pruneFixtures, ctx, { secret }), {
        removed: 2,
    })
    assert.deepEqual(
        ctx.db.tables.leagueFixtures.map((row) => row.matchId),
        ["listed"]
    )
    assert.deepEqual(
        ctx.db.tables.leagueResults.map((row) => row.matchId),
        ["current"]
    )
})
