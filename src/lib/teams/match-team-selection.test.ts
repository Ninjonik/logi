import {
    matchTeamGame,
    matchTeamSelectionIssues,
    setSlotSide,
    setSlotTeam,
    toMatchTeamInputs,
} from "./match-team-selection"
import type { MatchTeamAssignment } from "@/domain/teams/match-teams"
import assert from "node:assert/strict"
import test from "node:test"

test("only HLL (including legacy events without a game) and Wardogs have team slots", () => {
    assert.equal(matchTeamGame(undefined), "hell_let_loose")
    assert.equal(matchTeamGame("hell_let_loose"), "hell_let_loose")
    assert.equal(matchTeamGame("wardogs"), "wardogs")
    assert.equal(matchTeamGame("hell_let_loose_vietnam"), null)
})

test("stored assignments become slot-ordered inputs without snapshots", () => {
    const snapshot = {
        name: "Red",
        shortCode: null,
        logoAssetId: null,
        logoUrl: null,
        teamRevision: 1,
        capturedAt: "2026-10-01T00:00:00.000Z",
    }
    const stored: MatchTeamAssignment[] = [
        { teamId: "t2", slot: "b", side: "Axis", snapshot },
        { teamId: "t1", slot: "a", side: null, snapshot },
    ]
    assert.deepEqual(toMatchTeamInputs(stored), [
        { teamId: "t1", slot: "a", side: null },
        { teamId: "t2", slot: "b", side: "Axis" },
    ])
    assert.deepEqual(toMatchTeamInputs(undefined), [])
})

test("choosing a team keeps the slot side, clearing a slot drops it", () => {
    const start = [{ teamId: "t1", slot: "b" as const, side: "Allies" }]
    const replaced = setSlotTeam(start, "b", "t2")
    assert.deepEqual(replaced, [{ teamId: "t2", slot: "b", side: "Allies" }])
    const added = setSlotTeam(replaced, "a", "t3")
    assert.deepEqual(
        added.map((entry) => entry.slot),
        ["a", "b"],
        "slots stay in display order"
    )
    assert.deepEqual(added[0], { teamId: "t3", slot: "a", side: null })
    assert.deepEqual(setSlotTeam(added, "b", null), [
        { teamId: "t3", slot: "a", side: null },
    ])
    // The input array is never mutated.
    assert.deepEqual(start, [{ teamId: "t1", slot: "b", side: "Allies" }])
})

test("a side can only be set on an occupied slot", () => {
    const value = [{ teamId: "t1", slot: "a" as const, side: null }]
    assert.deepEqual(setSlotSide(value, "a", "Valkyra"), [
        { teamId: "t1", slot: "a", side: "Valkyra" },
    ])
    assert.deepEqual(setSlotSide(value, "c", "Lonestar"), value)
    assert.deepEqual(setSlotSide(setSlotSide(value, "a", "Axis"), "a", null), [
        { teamId: "t1", slot: "a", side: null },
    ])
})

test("duplicate teams and duplicate non-null sides are flagged per slot", () => {
    assert.deepEqual(
        matchTeamSelectionIssues([
            { teamId: "t1", slot: "a", side: null },
            { teamId: "t2", slot: "b", side: null },
        ]),
        {},
        "two open sides are not a conflict"
    )
    assert.deepEqual(
        matchTeamSelectionIssues([
            { teamId: "t1", slot: "a", side: "Valkyra" },
            { teamId: "t1", slot: "b", side: "Manticore" },
            { teamId: "t3", slot: "c", side: "Valkyra" },
        ]),
        { a: "duplicateTeam", b: "duplicateTeam", c: "duplicateSide" }
    )
})
