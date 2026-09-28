import assert from "node:assert/strict"
import test from "node:test"

import { canReceiveMatchRecap } from "./match-recap-notifications"

test("allows match recaps by default and when explicitly enabled", () => {
    assert.equal(canReceiveMatchRecap(undefined), true)
    assert.equal(canReceiveMatchRecap(true), true)
})

test("blocks unsent match recaps after a player unsubscribes", () => {
    assert.equal(canReceiveMatchRecap(false), false)
})
