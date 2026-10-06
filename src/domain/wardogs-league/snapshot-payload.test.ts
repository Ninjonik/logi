import {
    DEFAULT_LEAGUE_PANEL_OPTIONS,
    leaguePanelOptionsOf,
} from "./panel-data"
import { leagueSnapshotFixture } from "../../infrastructure/testing/league-fixtures"
import { readLeagueSnapshotPayload } from "./snapshot-payload"
import { leagueSnapshotSchema } from "./contracts"
import assert from "node:assert/strict"
import test from "node:test"

test("the stored League page reads back through the guard as the schema produced it", () => {
    const snapshot = leagueSnapshotSchema.parse(leagueSnapshotFixture())
    assert.deepEqual(
        readLeagueSnapshotPayload(JSON.stringify(snapshot)),
        snapshot
    )
    assert.equal(readLeagueSnapshotPayload(undefined), null)
    assert.equal(readLeagueSnapshotPayload(""), null)
    for (const bad of [
        "not json",
        "[]",
        JSON.stringify({ ...snapshot, parserVersion: "wardogs-league-html/0" }),
        JSON.stringify({ ...snapshot, fetchedAt: 12 }),
        JSON.stringify({ ...snapshot, teams: [{ code: 7 }] }),
        JSON.stringify({ ...snapshot, results: { placements: "none" } }),
        JSON.stringify({ ...snapshot, warnings: null }),
    ])
        assert.equal(readLeagueSnapshotPayload(bad), null, bad)
})

test("stored League panel options are checked as the editor's schema checks them", () => {
    assert.deepEqual(
        leaguePanelOptionsOf(DEFAULT_LEAGUE_PANEL_OPTIONS),
        DEFAULT_LEAGUE_PANEL_OPTIONS
    )
    assert.deepEqual(
        leaguePanelOptionsOf({
            ...DEFAULT_LEAGUE_PANEL_OPTIONS,
            fixtureCount: 10,
        }).fixtureCount,
        10
    )
    for (const fixtureCount of [0, 11, 2.5, Number.NaN])
        assert.throws(() =>
            leaguePanelOptionsOf({
                ...DEFAULT_LEAGUE_PANEL_OPTIONS,
                fixtureCount,
            })
        )
})
