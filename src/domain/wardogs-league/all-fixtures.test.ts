import {
    fixtureChanges,
    fixtureExpired,
    fixturePhase,
    fixtureStale,
    nearestFixtures,
    nextFixtureRefreshAt,
    FIXTURE_REFRESH_MS,
    FIXTURE_RETENTION_MS,
    FIXTURE_STALE_MS,
    LATE_KICKOFF_GRACE_MS,
    RESULT_HORIZON_MS,
    SETTLED_RESULT_MS,
} from "./all-fixtures"
import {
    completedLeagueSnapshot,
    leagueSnapshotFixture,
} from "../../infrastructure/testing/league-fixtures"
import type { LeagueMatch } from "./contracts"
import assert from "node:assert/strict"
import test from "node:test"

const steps = (
    states: Record<string, "done" | "current" | "not_started">
): LeagueMatch["progress"] =>
    leagueSnapshotFixture().progress!.map((step) => ({
        ...step,
        state: states[step.label] ?? step.state,
    }))

test("the captured Scheduled page is an upcoming fixture", () => {
    assert.equal(fixturePhase(leagueSnapshotFixture(), "fixtures"), "upcoming")
    assert.equal(fixturePhase(leagueSnapshotFixture(), null), "upcoming")
})

test("phase follows placements, then the status label, then progress, then the index tab", () => {
    const base = leagueSnapshotFixture()
    assert.equal(
        fixturePhase(
            completedLeagueSnapshot({
                id: "a",
                fixtureNumber: 1,
                scheduledAt: null,
                podium: ["ROG", "VLK", "DEF"],
            }),
            "fixtures"
        ),
        "completed"
    )
    for (const [status, phase] of [
        ["Cancelled", "cancelled"],
        ["Canceled", "cancelled"],
        ["No-show", "cancelled"],
        ["No show", "cancelled"],
        ["Completed", "completed"],
        ["Finished", "completed"],
        ["Confirmed", "completed"],
        ["Disputed", "completed"],
        ["Live", "live"],
    ] as const)
        assert.equal(fixturePhase({ ...base, status }, "fixtures"), phase)
    assert.equal(
        fixturePhase(
            { ...base, progress: steps({ Live: "current" }) },
            "fixtures"
        ),
        "live"
    )
    for (const label of ["Placements", "Confirmed", "Live"])
        assert.equal(
            fixturePhase(
                { ...base, progress: steps({ [label]: "done" }) },
                "fixtures"
            ),
            "completed",
            label
        )
    assert.equal(
        fixturePhase(
            { ...base, progress: steps({ Placements: "current" }) },
            null
        ),
        "completed"
    )
    // A Scheduled page that the League lists under results has finished.
    assert.equal(fixturePhase(base, "results"), "completed")
    assert.equal(fixturePhase(null, "results"), "completed")
    assert.equal(fixturePhase(null, "fixtures"), "upcoming")
    assert.equal(fixturePhase({ ...base, status: null }, null), "upcoming")
})

test("changes name what moved between two reads", () => {
    const before = leagueSnapshotFixture()
    assert.deepEqual(fixtureChanges(null, before), ["discovered"])
    assert.deepEqual(fixtureChanges(before, { ...before }), [])
    assert.deepEqual(
        fixtureChanges(before, {
            ...before,
            scheduledAt: "2026-10-10T19:00:00.000Z",
            map: { name: "Kardas", zone: null, lighting: null },
            hosting: { mode: "League-hosted", teamCode: null },
            moderator: "Kowalski",
            status: "Live",
        }),
        ["schedule", "map", "hosting", "preparation", "status"]
    )
    assert.deepEqual(
        fixtureChanges(before, {
            ...before,
            teams: before.teams!.slice(0, 2),
        }),
        ["teams", "preparation"]
    )
    const done = completedLeagueSnapshot({
        id: before.id,
        fixtureNumber: 38,
        scheduledAt: before.scheduledAt,
        podium: ["VLK", "ROG", "BAMC"],
    })
    assert.ok(fixtureChanges(before, done).includes("result"))
    assert.deepEqual(fixtureChanges(null, done), ["discovered", "result"])
})

test("refresh cadence: live and the nearest fixtures every cache period, distant ones slower", () => {
    const now = Date.parse("2026-10-03T12:00:00.000Z")
    const base = {
        scheduledAt: now + 7 * 86_400_000,
        firstSeenAt: now - 86_400_000,
        hasResult: false,
        resultConfirmed: false,
        inWindow: false,
        now,
    }
    assert.equal(
        nextFixtureRefreshAt({ ...base, phase: "live" }),
        now + FIXTURE_REFRESH_MS.window
    )
    assert.equal(
        nextFixtureRefreshAt({ ...base, phase: "upcoming", inWindow: true }),
        now + FIXTURE_REFRESH_MS.window
    )
    assert.equal(
        nextFixtureRefreshAt({
            ...base,
            phase: "upcoming",
            scheduledAt: now + 3600_000,
        }),
        now + FIXTURE_REFRESH_MS.window
    )
    assert.equal(
        nextFixtureRefreshAt({ ...base, phase: "upcoming" }),
        now + FIXTURE_REFRESH_MS.distant
    )
    assert.equal(
        nextFixtureRefreshAt({ ...base, phase: "upcoming", scheduledAt: null }),
        now + FIXTURE_REFRESH_MS.distant
    )
})

test("finished fixtures are re-read while placements may appear or change, then settle", () => {
    const kickoff = Date.parse("2026-10-01T18:00:00.000Z")
    const at = (offset: number, extra: object = {}) =>
        nextFixtureRefreshAt({
            phase: "completed",
            scheduledAt: kickoff,
            firstSeenAt: kickoff - 86_400_000,
            hasResult: false,
            resultConfirmed: false,
            inWindow: false,
            now: kickoff + offset,
            ...extra,
        })
    assert.equal(
        at(3600_000),
        kickoff + 3600_000 + FIXTURE_REFRESH_MS.awaitingResult
    )
    assert.equal(
        at(3 * 86_400_000),
        kickoff + 3 * 86_400_000 + FIXTURE_REFRESH_MS.settling
    )
    assert.equal(at(RESULT_HORIZON_MS), null)
    assert.equal(
        at(3600_000, { hasResult: true, resultConfirmed: true }),
        kickoff + 3600_000 + FIXTURE_REFRESH_MS.settling
    )
    assert.equal(
        at(SETTLED_RESULT_MS, { hasResult: true, resultConfirmed: true }),
        null
    )
    assert.equal(
        at(3 * 86_400_000, { hasResult: true }),
        kickoff + 3 * 86_400_000 + FIXTURE_REFRESH_MS.awaitingResult
    )
    assert.equal(
        nextFixtureRefreshAt({
            phase: "cancelled",
            scheduledAt: kickoff,
            firstSeenAt: kickoff,
            hasResult: false,
            resultConfirmed: false,
            inWindow: false,
            now: kickoff + 2 * 86_400_000,
        }),
        null
    )
})

test("retention keeps listed fixtures and drops old finished ones", () => {
    const kickoff = Date.parse("2026-09-01T18:00:00.000Z")
    const input = {
        phase: "completed" as const,
        scheduledAt: kickoff,
        firstSeenAt: kickoff,
        listed: false,
        now: kickoff + FIXTURE_RETENTION_MS,
    }
    assert.equal(fixtureExpired(input), true)
    assert.equal(fixtureExpired({ ...input, listed: true }), false)
    assert.equal(
        fixtureExpired({ ...input, now: kickoff + FIXTURE_RETENTION_MS - 1 }),
        false
    )
    assert.equal(
        fixtureExpired({
            ...input,
            phase: "upcoming",
            now: kickoff + RESULT_HORIZON_MS,
        }),
        true
    )
})

test("nearest fixtures: live first, then by kickoff, late ones dropped, unknown kickoff last", () => {
    const now = Date.parse("2026-10-09T12:00:00.000Z")
    const item = (
        matchId: string,
        phase: "upcoming" | "live" | "completed",
        scheduledAt: string | null,
        fixtureNumber: number | null = null
    ) => ({ matchId, phase, scheduledAt, fixtureNumber })
    const result = nearestFixtures(
        [
            item("later", "upcoming", "2026-10-11T18:00:00.000Z", 39),
            item("same-time-b", "upcoming", "2026-10-11T19:00:00.000Z", 41),
            item("same-time-a", "upcoming", "2026-10-11T19:00:00.000Z", 40),
            item("unknown", "upcoming", null),
            item("live", "live", "2026-10-09T11:00:00.000Z", 37),
            item("done", "completed", "2026-10-08T18:00:00.000Z", 36),
            item(
                "late",
                "upcoming",
                new Date(now - LATE_KICKOFF_GRACE_MS - 1).toISOString()
            ),
            item("soon", "upcoming", "2026-10-10T18:30:00.000Z", 38),
        ],
        now,
        4
    )
    assert.deepEqual(
        result.shown.map((f) => f.matchId),
        ["live", "soon", "later", "same-time-a"]
    )
    assert.equal(result.hidden, 2)
    assert.equal(result.total, 6)
    assert.deepEqual(nearestFixtures([], now, 6), {
        shown: [],
        hidden: 0,
        total: 0,
    })
})

test("a shown fixture is stale after a failed read or about three missed refreshes", () => {
    const now = Date.parse("2026-10-09T12:00:00.000Z")
    const fetchedAt = new Date(now - FIXTURE_STALE_MS + 1).toISOString()
    assert.equal(fixtureStale({ fetchedAt, error: null, now }), false)
    assert.equal(fixtureStale({ fetchedAt, error: "rate_limited", now }), true)
    assert.equal(
        fixtureStale({
            fetchedAt: new Date(now - FIXTURE_STALE_MS).toISOString(),
            error: null,
            now,
        }),
        true
    )
})
