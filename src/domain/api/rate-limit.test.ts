import assert from "node:assert/strict"
import test from "node:test"

import { takeRateLimitToken } from "./rate-limit"

const input = { now: 1_000, limit: 3, windowMs: 60_000 }

test("a missing or expired window starts a new one with one token taken", () => {
    const fresh = takeRateLimitToken(null, input)
    assert.deepEqual(fresh, {
        allowed: true,
        remaining: 2,
        resetAt: 61_000,
        window: { count: 1, resetAt: 61_000 },
    })
    const expired = takeRateLimitToken({ count: 3, resetAt: 1_000 }, input)
    assert.equal(expired.allowed, true)
    assert.deepEqual(expired.window, { count: 1, resetAt: 61_000 })
})

test("tokens count up inside the window and a full window refuses", () => {
    let window = takeRateLimitToken(null, input).window
    window = takeRateLimitToken(window, input).window
    const last = takeRateLimitToken(window, input)
    assert.equal(last.allowed, true)
    assert.equal(last.remaining, 0)
    const refused = takeRateLimitToken(last.window, input)
    assert.deepEqual(refused, {
        allowed: false,
        remaining: 0,
        resetAt: 61_000,
        window: { count: 3, resetAt: 61_000 },
    })
})

test("a refused request keeps the window unchanged", () => {
    const window = { count: 3, resetAt: 61_000 }
    assert.equal(takeRateLimitToken(window, input).window, window)
})
