import {
    completedLeagueSnapshot,
    InMemoryLeagueStore,
    leagueReadOf,
    leagueSnapshotFixture,
} from "../../infrastructure/testing/league-fixtures"
import {
    acceptFixtureRead,
    collectLeagueFixtures,
    isInPanelWindow,
    planIndexAdmission,
    type StoredFixtureState,
} from "./league-fixtures"
import {
    FIXTURE_REFRESH_MS,
    NEVER,
} from "../../domain/wardogs-league/all-fixtures"
import {
    CACHE_MS,
    type LeagueRead,
} from "../../domain/wardogs-league/contracts"
import assert from "node:assert/strict"
import test from "node:test"

const url = (id: string) => `https://wardogsleague.net/matches/${id}`

test("index admission adds new matches once, retabs finished ones and respects capacity", () => {
    const stored = new Map([
        ["known", { tab: "fixtures" as const }],
        ["same", { tab: "results" as const }],
    ])
    const plan = planIndexAdmission(
        stored,
        {
            fixtureUrls: [url("known"), url("new-a"), url("both"), url("same")],
            resultUrls: [url("both"), url("new-b"), url("known"), url("same")],
        },
        4
    )
    // Upcoming matches are admitted first; "both" is on both tabs and counts as finished.
    assert.deepEqual(plan.add, [
        { matchId: "new-a", tab: "fixtures" },
        { matchId: "both", tab: "results" },
    ])
    assert.equal(plan.skipped, 1)
    assert.deepEqual(plan.retab, [{ matchId: "known", tab: "results" }])
    assert.deepEqual([...plan.listed].sort(), [
        "both",
        "known",
        "new-a",
        "new-b",
        "same",
    ])
    assert.throws(() =>
        planIndexAdmission(
            new Map(),
            { fixtureUrls: ["https://evil.test/matches/x"], resultUrls: [] },
            10
        )
    )
})

const now = Date.parse("2026-10-03T12:00:00.000Z")
const state = (
    overrides: Partial<StoredFixtureState> = {}
): StoredFixtureState => ({
    matchId: "cmuqt8ep605e1lf018w2nlywu",
    firstSeenAt: now - 86_400_000,
    tab: "fixtures",
    snapshot: null,
    result: null,
    resultSeenAt: null,
    ...overrides,
})
const fresh = (overrides = {}) =>
    leagueSnapshotFixture({
        fetchedAt: new Date(now - 30_000).toISOString(),
        ...overrides,
    })

test("a first read discovers the fixture and schedules the next read with the cache", () => {
    const read = leagueReadOf(fresh(), now)
    const outcome = acceptFixtureRead(state(), read, { now, inWindow: true })
    assert.equal(outcome.phase, "upcoming")
    assert.deepEqual(outcome.changes, ["discovered"])
    assert.deepEqual(outcome.result, { kind: "keep" })
    assert.equal(outcome.error, null)
    assert.equal(outcome.nextRefreshAt, Date.parse(read.nextRefreshAt))
    // A distant fixture outside the panel window is read every 30 minutes.
    const distant = acceptFixtureRead(
        state(),
        leagueReadOf(fresh({ scheduledAt: "2026-11-30T18:00:00.000Z" }), now),
        { now, inWindow: false }
    )
    assert.equal(distant.nextRefreshAt, now + FIXTURE_REFRESH_MS.distant)
    // A cached page that is about to expire is not re-read within a minute.
    const cached = leagueReadOf(fresh(), now)
    cached.nextRefreshAt = new Date(now + 5_000).toISOString()
    assert.equal(
        acceptFixtureRead(state(), cached, { now, inWindow: true })
            .nextRefreshAt,
        now + 60_000
    )
})

test("failed reads keep the last good snapshot and honour the retry time", () => {
    const previous = fresh()
    const read: LeagueRead = {
        ...leagueReadOf(null, now, "rate_limited"),
        nextRefreshAt: new Date(now + 10 * 60_000).toISOString(),
    }
    const outcome = acceptFixtureRead(state({ snapshot: previous }), read, {
        now,
        inWindow: true,
    })
    assert.equal(outcome.snapshot, previous)
    assert.equal(outcome.error, "rate_limited")
    assert.deepEqual(outcome.changes, [])
    assert.equal(outcome.nextRefreshAt, now + 10 * 60_000)
    const soon = acceptFixtureRead(
        state(),
        {
            ...leagueReadOf(null, now, "network"),
            nextRefreshAt: new Date(now).toISOString(),
        },
        { now, inWindow: false }
    )
    assert.equal(soon.nextRefreshAt, now + 60_000)
    assert.equal(soon.phase, "upcoming")
})

test("placements create, keep and correct the stored result; losing them is rejected as drift", () => {
    const done = completedLeagueSnapshot({
        id: "cmuqt8ep605e1lf018w2nlywu",
        fixtureNumber: 38,
        scheduledAt: "2026-10-02T18:30:00.000Z",
        podium: ["VLK", "ROG", "BAMC"],
        confirmed: false,
        fetchedAt: new Date(now - 10_000).toISOString(),
    })
    const first = acceptFixtureRead(
        state({ snapshot: fresh(), tab: "results" }),
        leagueReadOf(done, now),
        { now, inWindow: false }
    )
    assert.equal(first.phase, "completed")
    assert.ok(first.changes.includes("result"))
    assert.equal(first.result.kind, "upsert")
    assert.equal(first.resultSeenAt, now)
    const record = first.result.kind === "upsert" ? first.result.record : null
    assert.equal(record?.placements[0].teamCode, "VLK")
    assert.equal(first.nextRefreshAt, now + FIXTURE_REFRESH_MS.awaitingResult)
    const same = acceptFixtureRead(
        state({ snapshot: done, result: record, resultSeenAt: now }),
        leagueReadOf(done, now + 1000),
        { now: now + 1000, inWindow: false }
    )
    assert.deepEqual(same.result, { kind: "keep" })
    assert.equal(same.resultSeenAt, now)
    const corrected = {
        ...done,
        results: { ...done.results!, confirmed: true },
        fetchedAt: new Date(now).toISOString(),
    }
    const fix = acceptFixtureRead(
        state({ snapshot: done, result: record, resultSeenAt: now }),
        leagueReadOf(corrected, now + 2000),
        { now: now + 2000, inWindow: false }
    )
    assert.equal(fix.result.kind, "upsert")
    const drift = acceptFixtureRead(
        state({ snapshot: done, result: record, resultSeenAt: now }),
        leagueReadOf(
            { ...done, results: null, fetchedAt: new Date(now).toISOString() },
            now + 3000
        ),
        { now: now + 3000, inWindow: false }
    )
    assert.equal(drift.snapshot, done)
    assert.equal(drift.error, "invalid_html")
    assert.deepEqual(drift.result, { kind: "keep" })
    // An inconsistent store without placements drops the orphaned result.
    const orphan = acceptFixtureRead(
        state({ snapshot: fresh(), result: record }),
        leagueReadOf(fresh({ fetchedAt: new Date(now).toISOString() }), now),
        { now, inWindow: false }
    )
    assert.deepEqual(orphan.result, { kind: "remove" })
})

test("old cancelled and long-settled fixtures are not read again", () => {
    const cancelled = acceptFixtureRead(
        state({ firstSeenAt: now - 30 * 86_400_000 }),
        leagueReadOf(
            fresh({
                status: "Cancelled",
                scheduledAt: "2026-09-01T18:00:00.000Z",
            }),
            now
        ),
        { now, inWindow: false }
    )
    assert.equal(cancelled.phase, "cancelled")
    assert.equal(cancelled.nextRefreshAt, NEVER)
})

test("the panel window covers the ten nearest open fixtures", () => {
    const open = Array.from({ length: 12 }, (_, i) => ({
        matchId: `m${i}`,
        phase: "upcoming" as const,
        scheduledAt: new Date(now + (i + 1) * 3600_000).toISOString(),
        fixtureNumber: i,
    }))
    assert.equal(isInPanelWindow("m9", open, now), true)
    assert.equal(isInPanelWindow("m10", open, now), false)
})

test("collection reads due fixtures live and upcoming first, stores failures, and bounds each run", async () => {
    const store = new InMemoryLeagueStore(now)
    store.admit({
        fixtureUrls: [url("up")],
        resultUrls: [url("old"), url("broken")],
    })
    const reads: string[] = []
    const ports = store.collectionPorts(async (source) => {
        reads.push(source)
        if (source.endsWith("broken")) throw new Error("socket closed")
        const id = source.split("/").pop()!
        return leagueReadOf(
            id === "old"
                ? completedLeagueSnapshot({
                      id,
                      fixtureNumber: 30,
                      scheduledAt: "2026-10-01T18:00:00.000Z",
                      podium: ["ROG", "VLK", "DEF"],
                      fetchedAt: new Date(now - 1000).toISOString(),
                  })
                : fresh({ id, sourceUrl: source }),
            now
        )
    })
    assert.deepEqual(await collectLeagueFixtures(ports, 2), {
        read: 2,
        failed: 0,
        lost: 0,
    })
    assert.equal(reads[0], url("up"))
    assert.equal(store.fixtures.get("old")?.phase, "completed")
    assert.equal(store.results.get("old")?.placements[0].teamCode, "ROG")
    assert.equal(store.resultsRevision, 1)
    assert.deepEqual(await collectLeagueFixtures(ports, 5), {
        read: 0,
        failed: 1,
        lost: 0,
    })
    const broken = store.fixtures.get("broken")!
    assert.equal(broken.error, "network")
    assert.equal(broken.snapshot, null)
    assert.equal(broken.nextRefreshAt, now + 60_000)
    // Nothing is due until the next cadence.
    assert.deepEqual(await collectLeagueFixtures(ports, 5), {
        read: 0,
        failed: 0,
        lost: 0,
    })
    store.current = now + CACHE_MS
    assert.deepEqual(await collectLeagueFixtures(ports, 5), {
        read: 1,
        failed: 1,
        lost: 0,
    })
})

test("a lease lost while reading is reported and changes nothing", async () => {
    const store = new InMemoryLeagueStore(now)
    store.admit({ fixtureUrls: [url("up")], resultUrls: [] })
    const ports = store.collectionPorts(async () => {
        store.current += 60_000
        return leagueReadOf(fresh({ id: "up", sourceUrl: url("up") }), now)
    })
    assert.deepEqual(await collectLeagueFixtures(ports, 1), {
        read: 1,
        failed: 0,
        lost: 1,
    })
    assert.equal(store.fixtures.get("up")?.snapshot, null)
})
