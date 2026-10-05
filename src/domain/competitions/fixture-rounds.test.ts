import {
    defaultFixturePhase,
    fixtureRowState,
    groupFixturesByRound,
    rankLinkCandidates,
    suggestedRound,
} from "./fixture-rounds"
import type {
    CompetitionFixtureView,
    CompetitionTeamView,
    FixtureEventCandidate,
} from "./admin-view"
import assert from "node:assert/strict"
import test from "node:test"

const side = (id: string): CompetitionTeamView => ({
    id,
    name: id.toUpperCase(),
    shortCode: null,
    logoUrl: null,
    archived: false,
    legacy: false,
})

function fixture(
    id: string,
    extra: Partial<CompetitionFixtureView> = {}
): CompetitionFixtureView {
    return {
        id,
        divisionId: "d1",
        phase: "league",
        round: null,
        sideA: side("vlk"),
        sideB: side("rog"),
        scheduledAt: null,
        scoreA: null,
        scoreB: null,
        status: "scheduled",
        event: null,
        ...extra,
    }
}

test("fixtures are grouped by round, latest round first and unnumbered last", () => {
    const groups = groupFixturesByRound(
        [
            fixture("a", { round: 2, scheduledAt: "2026-10-04T18:00:00Z" }),
            fixture("b", { round: 3, scheduledAt: "2026-10-18T18:00:00Z" }),
            fixture("c", { round: 3, scheduledAt: "2026-10-17T16:00:00Z" }),
            fixture("d"),
            fixture("e", { round: 2, scheduledAt: "2026-10-03T18:00:00Z" }),
        ],
        { divisionId: "d1", phase: "league" }
    )
    assert.deepEqual(
        groups.map((group) => [
            group.round,
            group.fixtures.map((item) => item.id),
            group.from,
            group.to,
        ]),
        [
            [3, ["c", "b"], "2026-10-17T16:00:00Z", "2026-10-18T18:00:00Z"],
            [2, ["e", "a"], "2026-10-03T18:00:00Z", "2026-10-04T18:00:00Z"],
            [null, ["d"], null, null],
        ]
    )
})

test("grouping keeps only the chosen division and phase; a null division shows all", () => {
    const fixtures = [
        fixture("league-d1", { round: 1 }),
        fixture("league-d2", { round: 1, divisionId: "d2" }),
        fixture("playoff-d1", { round: 1, phase: "playoff" }),
    ]
    assert.deepEqual(
        groupFixturesByRound(fixtures, { divisionId: "d1", phase: "league" })
            .flatMap((group) => group.fixtures)
            .map((item) => item.id),
        ["league-d1"]
    )
    assert.deepEqual(
        groupFixturesByRound(fixtures, { divisionId: null, phase: "league" })
            .flatMap((group) => group.fixtures)
            .map((item) => item.id),
        ["league-d1", "league-d2"]
    )
    assert.deepEqual(
        groupFixturesByRound(fixtures, {
            divisionId: "d1",
            phase: "relegation",
        }),
        []
    )
})

test("a legacy fixture without a round field reads as unnumbered", () => {
    const legacy = fixture("old")
    delete (legacy as Partial<CompetitionFixtureView>).round
    assert.equal(
        groupFixturesByRound([legacy], { divisionId: null, phase: "league" })[0]
            ?.round,
        null
    )
})

test("the default phase is league when present, else the first phase in use", () => {
    assert.equal(defaultFixturePhase([], "d1"), "league")
    assert.equal(
        defaultFixturePhase(
            [
                fixture("p", { phase: "playoff" }),
                fixture("r", { phase: "relegation" }),
            ],
            "d1"
        ),
        "playoff"
    )
    assert.equal(
        defaultFixturePhase(
            [fixture("p", { phase: "playoff" }), fixture("l")],
            "d1"
        ),
        "league"
    )
    assert.equal(
        defaultFixturePhase(
            [fixture("p", { phase: "relegation", divisionId: "d2" })],
            "d1"
        ),
        "league"
    )
})

test("row state follows schedule, link, imported result and confirmation", () => {
    const event = {
        id: "e1",
        name: "VLK vs ROG",
        gameStart: "2026-10-18T18:00:00Z",
        workspace: "Valkyria",
        hasResult: false,
        reviewed: false,
    }
    assert.equal(fixtureRowState(fixture("a")), "unlinked")
    assert.equal(fixtureRowState(fixture("a", { event })), "linked")
    assert.equal(
        fixtureRowState(
            fixture("a", {
                status: "final",
                event: { ...event, hasResult: true },
            })
        ),
        "awaiting_confirmation"
    )
    assert.equal(
        fixtureRowState(
            fixture("a", {
                status: "final",
                event: { ...event, hasResult: true, reviewed: true },
            })
        ),
        "played"
    )
    assert.equal(fixtureRowState(fixture("a", { status: "final" })), "played")
    assert.equal(
        fixtureRowState(fixture("a", { status: "forfeit", event })),
        "forfeit"
    )
})

test("a new fixture suggests the latest listed round, or the first", () => {
    assert.equal(suggestedRound([]), 1)
    assert.equal(
        suggestedRound([
            { round: 4, fixtures: [], from: null, to: null },
            { round: null, fixtures: [], from: null, to: null },
        ]),
        4
    )
    assert.equal(
        suggestedRound([{ round: null, fixtures: [], from: null, to: null }]),
        1
    )
})

test("link candidates are searched and ranked by assigned teams and nearness", () => {
    const candidate = (
        id: string,
        gameStart: string,
        extra: Partial<FixtureEventCandidate> = {}
    ): FixtureEventCandidate => ({
        id,
        name: `Match ${id}`,
        gameStart,
        workspace: "Valkyria",
        teamsMatch: false,
        hasResult: false,
        ...extra,
    })
    const candidates = [
        candidate("far", "2026-10-25T18:00:00Z"),
        candidate("near", "2026-10-18T19:00:00Z"),
        candidate("assigned", "2026-10-30T18:00:00Z", { teamsMatch: true }),
        candidate("other", "2026-10-18T18:00:00Z", { workspace: "Rogue" }),
    ]
    assert.deepEqual(
        rankLinkCandidates(candidates, {
            scheduledAt: "2026-10-18T18:00:00Z",
            search: "",
        }).map((item) => item.id),
        ["assigned", "other", "near", "far"]
    )
    assert.deepEqual(
        rankLinkCandidates(candidates, { scheduledAt: null, search: "" }).map(
            (item) => item.id
        ),
        ["assigned", "far", "near", "other"]
    )
    assert.deepEqual(
        rankLinkCandidates(candidates, {
            scheduledAt: null,
            search: "  ROGUE ",
        }).map((item) => item.id),
        ["other"]
    )
    assert.deepEqual(
        rankLinkCandidates(candidates, {
            scheduledAt: null,
            search: "match n",
        }).map((item) => item.id),
        ["near"]
    )
})
