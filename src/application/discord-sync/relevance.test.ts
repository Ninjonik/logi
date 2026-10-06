import assert from "node:assert/strict"
import test from "node:test"

import {
    CONCLUDED_EVENT_RETENTION_MS,
    historicalConcludedEventCutoff,
    isHistoricalConcludedEvent,
} from "./relevance"

const now = new Date("2026-08-29T12:00:00.000Z")

test("a concluded event is historical seven days after it ended", () => {
    assert.equal(CONCLUDED_EVENT_RETENTION_MS, 7 * 24 * 60 * 60 * 1000)
    assert.equal(
        isHistoricalConcludedEvent(
            { status: "concluded", gameEnd: "2026-08-22T11:59:59.000Z" },
            now
        ),
        true
    )
    assert.equal(
        isHistoricalConcludedEvent(
            { status: "concluded", gameEnd: "2026-08-22T12:00:00.000Z" },
            now
        ),
        false
    )
})

test("an event that is not concluded is never historical, whatever its date", () => {
    assert.equal(
        isHistoricalConcludedEvent(
            { status: "registration", gameEnd: "2025-01-01T00:00:00.000Z" },
            now
        ),
        false
    )
    assert.equal(
        isHistoricalConcludedEvent(
            { gameEnd: "2025-01-01T00:00:00.000Z" },
            now
        ),
        false
    )
    assert.equal(
        isHistoricalConcludedEvent({ status: "concluded" }, now),
        false
    )
})

test("the read cutoff starts a day before the window so every event the rule keeps is read", () => {
    const cutoff = historicalConcludedEventCutoff(now)
    assert.equal(cutoff, "2026-08-21T12:00:00.000Z")
    // The last instant the rule still keeps sorts after the cutoff.
    assert.ok("2026-08-22T12:00:00.000Z" >= cutoff)
    // An end written with a UTC offset sorts by its local time; the slack
    // keeps it inside the read.
    assert.ok("2026-08-22T02:00:00.000+02:00" >= cutoff)
})
