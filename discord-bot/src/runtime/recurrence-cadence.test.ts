import assert from "node:assert/strict"
import test from "node:test"

import {
    createRecurrenceGate,
    RECURRENCE_INTERVAL_MS,
} from "./recurrence-cadence"

const MINUTE_MS = 60_000

test("the recurrence pass runs once at start and then at most every 15 minutes", () => {
    const gate = createRecurrenceGate()
    const start = Date.parse("2026-10-06T10:00:00.000Z")
    assert.equal(gate.claim(start), true, "the first tick after start")
    // The reconcile tick runs every minute; none of those runs the pass.
    for (let tick = 1; tick < 15; tick += 1)
        assert.equal(
            gate.claim(start + tick * MINUTE_MS),
            false,
            `tick ${tick}`
        )
    assert.equal(gate.claim(start + RECURRENCE_INTERVAL_MS), true)
    assert.equal(gate.claim(start + RECURRENCE_INTERVAL_MS + MINUTE_MS), false)
})

test("a claimed pass counts from its own time, not from the start", () => {
    const gate = createRecurrenceGate(10 * MINUTE_MS)
    assert.equal(gate.claim(0), true)
    // A tick that came late still waits the full interval from the last pass.
    assert.equal(gate.claim(12 * MINUTE_MS), true)
    assert.equal(gate.claim(21 * MINUTE_MS), false)
    assert.equal(gate.claim(22 * MINUTE_MS), true)
})
