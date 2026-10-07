import assert from "node:assert/strict"
import test from "node:test"

import { seedProgress } from "./progress"

test("the board's progress bars render exactly (P5-08, P5-11)", () => {
    assert.deepEqual(seedProgress(12, 40), {
        players: 12,
        liveFrom: 40,
        filled: 3,
        bar: "▰▰▰▱▱▱▱▱▱▱",
        missing: 28,
        stage: "starting",
    })
    assert.deepEqual(seedProgress(31, 40), {
        players: 31,
        liveFrom: 40,
        filled: 8,
        bar: "▰▰▰▰▰▰▰▰▱▱",
        missing: 9,
        stage: "close",
    })
})

test("the bar is full only at the live threshold", () => {
    assert.equal(seedProgress(39, 40).bar, "▰▰▰▰▰▰▰▰▰▱")
    assert.equal(
        seedProgress(38, 40).filled,
        9,
        "regression: 9.5 rounds up but must not show a full bar below 40"
    )
    assert.deepEqual(seedProgress(40, 40), {
        players: 40,
        liveFrom: 40,
        filled: 10,
        bar: "▰▰▰▰▰▰▰▰▰▰",
        missing: 0,
        stage: "live",
    })
    assert.equal(seedProgress(43, 40).missing, 0)
    assert.equal(seedProgress(0, 40).bar, "▱▱▱▱▱▱▱▱▱▱")
})

test("every bar has ten segments for any threshold", () => {
    for (const liveFrom of [2, 7, 40, 99])
        for (const players of [0, 1, liveFrom - 1, liveFrom, liveFrom * 2])
            assert.equal(
                [...seedProgress(players, liveFrom).bar].length,
                10,
                `${players}/${liveFrom}`
            )
})

test("the close stage starts in the last quarter", () => {
    assert.equal(seedProgress(29, 40).stage, "starting")
    assert.equal(seedProgress(30, 40).stage, "close")
})

test("an unknown count shows an empty bar and no missing number", () => {
    assert.deepEqual(seedProgress(null, 40), {
        players: null,
        liveFrom: 40,
        filled: 0,
        bar: "▱▱▱▱▱▱▱▱▱▱",
        missing: null,
        stage: "starting",
    })
})

test("invalid counts and thresholds are rejected", () => {
    assert.throws(() => seedProgress(12, 0), RangeError)
    assert.throws(() => seedProgress(12, 1.5), RangeError)
    assert.throws(() => seedProgress(-1, 40), RangeError)
    assert.throws(() => seedProgress(1.5, 40), RangeError)
})
