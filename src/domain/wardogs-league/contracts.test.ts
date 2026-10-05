import {
    leagueMatchSchema,
    leagueResultsSchema,
    leagueSnapshotSchema,
    losesMatchStructure,
} from "./contracts"
import {
    completedLeagueSnapshot,
    leagueSnapshotFixture,
} from "../../infrastructure/testing/league-fixtures"
import assert from "node:assert/strict"
import test from "node:test"

test("results are null until parsed, and parsed placements validate", () => {
    assert.ok(leagueSnapshotSchema.parse(leagueSnapshotFixture()))
    const done = completedLeagueSnapshot({
        id: "m1",
        fixtureNumber: 1,
        scheduledAt: null,
        podium: ["ROG", "VLK", "DEF"],
    })
    assert.deepEqual(leagueSnapshotSchema.parse(done).results, {
        placements: [
            { place: 1, teamCode: "ROG" },
            { place: 2, teamCode: "VLK" },
            { place: 3, teamCode: "DEF" },
        ],
        confirmed: true,
    })
})

test("a team cannot finish twice, places are 1–20 and results need a team", () => {
    const valid = {
        placements: [
            { place: 1, teamCode: "ROG" },
            { place: 1, teamCode: "VLK" },
        ],
        confirmed: false,
    }
    assert.ok(leagueResultsSchema.parse(valid))
    for (const invalid of [
        {
            ...valid,
            placements: [
                { place: 1, teamCode: "ROG" },
                { place: 2, teamCode: "ROG" },
            ],
        },
        { ...valid, placements: [{ place: 0, teamCode: "ROG" }] },
        { ...valid, placements: [{ place: 21, teamCode: "ROG" }] },
        { ...valid, placements: [] },
        { placements: valid.placements },
    ])
        assert.equal(leagueResultsSchema.safeParse(invalid).success, false)
    assert.equal(
        leagueMatchSchema.safeParse({
            ...leagueSnapshotFixture(),
            results: { placements: [], confirmed: true },
        }).success,
        false
    )
})

test("losing published placements on a later read is structure loss, not a reset", () => {
    const done = completedLeagueSnapshot({
        id: "m1",
        fixtureNumber: 1,
        scheduledAt: "2026-10-01T18:00:00.000Z",
        podium: ["ROG", "VLK", "DEF"],
    })
    assert.equal(losesMatchStructure(done, { ...done, results: null }), true)
    assert.equal(
        losesMatchStructure(leagueSnapshotFixture(), {
            ...leagueSnapshotFixture(),
            results: done.results,
        }),
        false
    )
})
