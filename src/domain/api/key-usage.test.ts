import assert from "node:assert/strict"
import test from "node:test"

import { KEY_USAGE_INTERVAL_MS, keyUseDue } from "./key-usage"

const now = Date.parse("2026-10-06T10:00:00.000Z")

test("a key without a recorded use, or with an unreadable one, is due", () => {
    assert.equal(keyUseDue(undefined, now), true)
    assert.equal(keyUseDue(null, now), true)
    assert.equal(keyUseDue("not a date", now), true)
})

test("a recent use is not recorded again before the interval", () => {
    const recent = new Date(now - KEY_USAGE_INTERVAL_MS + 1).toISOString()
    assert.equal(keyUseDue(recent, now), false)
    const old = new Date(now - KEY_USAGE_INTERVAL_MS).toISOString()
    assert.equal(keyUseDue(old, now), true)
})

test("the interval can be narrowed", () => {
    const at = new Date(now - 1_000).toISOString()
    assert.equal(keyUseDue(at, now, 500), true)
    assert.equal(keyUseDue(at, now, 5_000), false)
})
