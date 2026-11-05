import { fixture } from "@/infrastructure/testing/wardogs-team-fixtures"
import { fixturePrefill } from "./fixture-prefill"
import assert from "node:assert/strict"
import test from "node:test"
test("API prefill uses game kickoff in the clan timezone and retains missing team names without invented catalogue entries", () => {
    const patch = fixturePrefill(fixture, [], "Europe/Prague")
    assert.equal(patch.date, "2027-01-20")
    assert.equal(patch.time, "20:00")
    assert.equal(
        patch.wardogsFixtureUrl,
        `https://wardogsleague.net/matches/${fixture.id}`
    )
    assert.match(patch.description!, /New team/)
    assert.equal(patch.opponent, null)
    assert.equal(patch.ownSide, "Valkyra")
    assert.equal("signupGroupIds" in patch, false)
    assert.equal("registrationHours" in patch, false)
})
