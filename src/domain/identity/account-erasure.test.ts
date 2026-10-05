import assert from "node:assert/strict"
import test from "node:test"

import { erasureConfirmationMatches } from "./account-erasure"

test("the exact name confirms, ignoring case and surrounding spaces", () => {
    assert.equal(erasureConfirmationMatches("Hráč 01", "Hráč 01"), true)
    assert.equal(erasureConfirmationMatches("  hráč 01 ", "Hráč 01"), true)
})

test("anything else does not confirm", () => {
    assert.equal(erasureConfirmationMatches("", "Hráč 01"), false)
    assert.equal(erasureConfirmationMatches("Hrac 01", "Hráč 01"), false)
    assert.equal(erasureConfirmationMatches("Hráč", "Hráč 01"), false)
})

test("an account without a name cannot be confirmed by an empty input", () => {
    assert.equal(erasureConfirmationMatches("", "  "), false)
    assert.equal(erasureConfirmationMatches(" ", ""), false)
})
