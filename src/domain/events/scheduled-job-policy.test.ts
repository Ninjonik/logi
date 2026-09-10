import assert from "node:assert/strict"
import test from "node:test"

import {
    getSignupReminderDueAt,
    resolveSignupReminderStatuses,
} from "./scheduled-job-policy"

test("schedules the first signup reminder 24 hours after match creation", () => {
    assert.equal(
        getSignupReminderDueAt(
            "2026-01-01T10:00:00.000Z",
            "2026-01-03T10:00:00.000Z",
            new Date("2026-01-01T11:00:00.000Z")
        ),
        "2026-01-02T10:00:00.000Z"
    )
})

test("does not schedule a signup reminder after registration ends", () => {
    assert.equal(
        getSignupReminderDueAt(
            "2026-01-01T10:00:00.000Z",
            "2026-01-02T09:00:00.000Z",
            new Date("2026-01-01T11:00:00.000Z")
        ),
        null
    )
})

test("reschedules an edited open match for the next daily reminder", () => {
    assert.equal(
        getSignupReminderDueAt(
            "2026-01-01T10:00:00.000Z",
            "2026-01-05T10:00:00.000Z",
            new Date("2026-01-03T10:00:00.000Z")
        ),
        "2026-01-04T10:00:00.000Z"
    )
})

test("schedules an overdue first reminder immediately for an open match", () => {
    assert.equal(
        getSignupReminderDueAt(
            "2026-01-01T10:00:00.000Z",
            "2026-01-03T10:00:00.000Z",
            new Date("2026-01-02T11:00:00.000Z"),
            true
        ),
        "2026-01-02T11:00:00.000Z"
    )
})

test("uses regular members as the default for legacy matches", () => {
    assert.deepEqual(resolveSignupReminderStatuses(undefined), ["member"])
    assert.deepEqual(resolveSignupReminderStatuses([]), [])
})
