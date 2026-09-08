import assert from "node:assert/strict"
import test from "node:test"

import {
    getAttendanceReminderDueAt,
    isExpiredScheduledJobClaim,
    shouldDiscardScheduledJob,
} from "./scheduled-job-policy"

const now = new Date("2026-08-29T17:00:00.000Z")

test("scheduled jobs for concluded events are always discarded", () => {
    assert.equal(
        shouldDiscardScheduledJob({
            eventStatus: "concluded",
            gameEnd: "2026-08-29T16:00:00.000Z",
            now,
        }),
        true
    )
})

test("scheduled jobs for historical events are discarded even if status reconciliation was missed", () => {
    assert.equal(
        shouldDiscardScheduledJob({
            eventStatus: "registration",
            gameEnd: "2026-08-22T16:59:59.999Z",
            now,
        }),
        true
    )
    assert.equal(
        shouldDiscardScheduledJob({
            eventStatus: "registration",
            gameEnd: "2026-08-22T17:00:00.000Z",
            now,
        }),
        false
    )
})

test("a job claim is recoverable after five minutes or when its timestamp is missing", () => {
    assert.equal(
        isExpiredScheduledJobClaim("2026-08-29T16:55:00.000Z", now),
        false
    )
    assert.equal(
        isExpiredScheduledJobClaim("2026-08-29T16:54:59.999Z", now),
        true
    )
    assert.equal(isExpiredScheduledJobClaim(undefined, now), true)
})

test("the 24-hour reminder is due immediately when a future match is rescheduled inside its window", () => {
    assert.equal(
        getAttendanceReminderDueAt("2026-08-30T12:00:00.000Z", 24, now),
        now.toISOString()
    )
    assert.equal(
        getAttendanceReminderDueAt("2026-08-30T12:00:00.000Z", 18, now),
        "2026-08-29T18:00:00.000Z"
    )
})

test("past later reminder windows are not backfilled and past meetings receive no reminder", () => {
    assert.equal(
        getAttendanceReminderDueAt("2026-08-29T22:00:00.000Z", 18, now),
        null
    )
    assert.equal(
        getAttendanceReminderDueAt("2026-08-29T16:00:00.000Z", 24, now),
        null
    )
})
