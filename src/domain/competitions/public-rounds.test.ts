import assert from "node:assert/strict"
import test from "node:test"

import {
    describeFixtureSpan,
    fixtureRound,
    fixturesForView,
    groupPublicFixtures,
    PLAYOFF_VIEW,
    selectCompetitionView,
    weekStartUtc,
} from "./public-rounds"
import type { PublicCompetitionFixture } from "./competition"

function fixture(
    id: string,
    status: PublicCompetitionFixture["status"],
    scheduledAt?: string,
    extra: Record<string, unknown> = {}
): PublicCompetitionFixture {
    return {
        id,
        phase: "league",
        teamAId: "a",
        teamBId: "b",
        status,
        ...(scheduledAt ? { scheduledAt } : {}),
        ...extra,
    } as PublicCompetitionFixture
}

test("a round is read only when the record has a usable one", () => {
    assert.equal(fixtureRound(fixture("a", "scheduled")), null)
    assert.equal(
        fixtureRound(fixture("a", "scheduled", undefined, { round: 3 })),
        3
    )
    assert.equal(
        fixtureRound(
            fixture("a", "scheduled", undefined, { round: " Final " })
        ),
        "Final"
    )
    for (const round of [0, -1, 2.5, "", "  ", null, true, {}])
        assert.equal(
            fixtureRound(fixture("a", "scheduled", undefined, { round })),
            null
        )
})

test("weeks start on Monday in UTC", () => {
    // 2026-10-05 is a Monday.
    const monday = Date.parse("2026-10-05T00:00:00Z")
    assert.equal(weekStartUtc(Date.parse("2026-10-05T00:00:00Z")), monday)
    assert.equal(weekStartUtc(Date.parse("2026-10-11T23:59:00Z")), monday)
    assert.equal(
        weekStartUtc(Date.parse("2026-10-04T23:59:00Z")),
        monday - 7 * 24 * 60 * 60 * 1000
    )
})

test("fixtures with rounds are grouped by round, upcoming soonest first", () => {
    const { upcoming, results } = groupPublicFixtures([
        fixture("r4", "scheduled", "2026-10-17T18:00:00Z", { round: 4 }),
        fixture("r3b", "scheduled", "2026-10-11T20:00:00Z", { round: 3 }),
        fixture("r3a", "scheduled", "2026-10-10T18:00:00Z", { round: 3 }),
        fixture("r2a", "final", "2026-10-04T18:00:00Z", { round: 2 }),
        fixture("r2b", "forfeit", "2026-10-03T18:00:00Z", { round: 2 }),
        fixture("r1", "final", "2026-09-27T18:00:00Z", { round: 1 }),
    ])
    assert.deepEqual(
        upcoming.map((group) => [group.round, group.fixtures.map((f) => f.id)]),
        [
            [3, ["r3a", "r3b"]],
            [4, ["r4"]],
        ]
    )
    assert.deepEqual(upcoming[0].first, "2026-10-10T18:00:00Z")
    assert.deepEqual(upcoming[0].last, "2026-10-11T20:00:00Z")
    assert.deepEqual(
        results.map((group) => [group.round, group.fixtures.map((f) => f.id)]),
        [
            [2, ["r2a", "r2b"]],
            [1, ["r1"]],
        ]
    )
})

test("without rounds fixtures are grouped by week, undated last", () => {
    const { upcoming, results } = groupPublicFixtures([
        fixture("sun", "scheduled", "2026-10-11T20:00:00Z"),
        fixture("undated", "scheduled"),
        fixture("sat", "scheduled", "2026-10-10T18:00:00Z"),
        fixture("next", "scheduled", "2026-10-13T18:00:00Z"),
        fixture("played", "final", "2026-10-04T18:00:00Z"),
        fixture("playedUndated", "final"),
    ])
    assert.deepEqual(
        upcoming.map((group) => group.fixtures.map((f) => f.id)),
        [["sat", "sun"], ["next"], ["undated"]]
    )
    assert.ok(upcoming.every((group) => group.round === null))
    assert.equal(upcoming[2].first, null)
    assert.deepEqual(
        results.map((group) => group.fixtures.map((f) => f.id)),
        [["played"], ["playedUndated"]]
    )
})

test("a group's dates are described relative to this week", () => {
    // Monday 5 October 2026.
    const now = Date.parse("2026-10-05T09:00:00Z")
    const span = (first: string | null, last: string | null = first) =>
        describeFixtureSpan({ first, last }, now)
    assert.deepEqual(span(null), { kind: "undated" })
    assert.deepEqual(span("2026-10-10T18:00:00Z", "2026-10-11T20:00:00Z"), {
        kind: "this_weekend",
    })
    assert.deepEqual(span("2026-10-07T18:00:00Z", "2026-10-10T18:00:00Z"), {
        kind: "this_week",
    })
    assert.deepEqual(span("2026-10-17T18:00:00Z"), { kind: "next_week" })
    assert.deepEqual(span("2026-10-11T18:00:00Z", "2026-10-13T18:00:00Z"), {
        kind: "range",
        from: "2026-10-11T18:00:00Z",
        to: "2026-10-13T18:00:00Z",
    })
    assert.deepEqual(span("2026-10-24T18:00:00Z"), {
        kind: "range",
        from: "2026-10-24T18:00:00Z",
        to: "2026-10-24T18:00:00Z",
    })
})

test("the play-off tab exists only with play-off fixtures and gathers them", () => {
    const divisions = [
        {
            id: "d1",
            fixtures: [
                fixture("league", "final"),
                { ...fixture("po", "scheduled"), phase: "playoff" as const },
                {
                    ...fixture("rel", "scheduled"),
                    phase: "relegation" as const,
                },
            ],
        },
        { id: "d2", fixtures: [fixture("league2", "final")] },
    ]
    assert.deepEqual(selectCompetitionView(divisions, undefined), {
        kind: "division",
        divisionId: "d1",
    })
    assert.deepEqual(selectCompetitionView(divisions, "d2"), {
        kind: "division",
        divisionId: "d2",
    })
    assert.deepEqual(selectCompetitionView(divisions, "missing"), {
        kind: "division",
        divisionId: "d1",
    })
    assert.deepEqual(selectCompetitionView(divisions, PLAYOFF_VIEW), {
        kind: "playoff",
    })
    assert.deepEqual(
        fixturesForView(divisions, { kind: "playoff" }).map((f) => f.id),
        ["po"]
    )
    assert.deepEqual(
        fixturesForView(divisions, { kind: "division", divisionId: "d1" }).map(
            (f) => f.id
        ),
        ["league", "rel"]
    )
    const withoutPlayoff = [{ id: "d1", fixtures: [fixture("x", "final")] }]
    assert.deepEqual(selectCompetitionView(withoutPlayoff, PLAYOFF_VIEW), {
        kind: "division",
        divisionId: "d1",
    })
    assert.equal(selectCompetitionView([], undefined), null)
})
