import assert from "node:assert/strict"
import test from "node:test"

import { isRegistrationAnnouncementDue } from "./registration-announcement"

test("missing registration start preserves immediate announcements for legacy events", () => {
    assert.equal(
        isRegistrationAnnouncementDue({}, new Date("2026-01-01T10:00:00.000Z")),
        true
    )
})

test("registration announcements wait until their configured start time", () => {
    const event = { registrationStart: "2026-01-01T12:00:00.000Z" }
    assert.equal(
        isRegistrationAnnouncementDue(
            event,
            new Date("2026-01-01T11:59:59.000Z")
        ),
        false
    )
    assert.equal(
        isRegistrationAnnouncementDue(
            event,
            new Date("2026-01-01T12:00:00.000Z")
        ),
        true
    )
})
