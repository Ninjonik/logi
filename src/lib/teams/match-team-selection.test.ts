import { matchTeamGame } from "./match-team-selection"
import assert from "node:assert/strict"
import test from "node:test"

test("only HLL (including legacy events without a game) and Wardogs have team slots", () => {
    assert.equal(matchTeamGame(undefined), "hell_let_loose")
    assert.equal(matchTeamGame("hell_let_loose"), "hell_let_loose")
    assert.equal(matchTeamGame("wardogs"), "wardogs")
    assert.equal(matchTeamGame("hell_let_loose_vietnam"), null)
})
