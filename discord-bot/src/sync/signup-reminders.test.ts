import assert from "node:assert/strict"
import test from "node:test"

import { isSignupReminderRecipient } from "./signup-reminders"

test("signup reminders include legacy memberships for Hell Let Loose events", () => {
    assert.equal(
        isSignupReminderRecipient({
            assignment: {
                userId: "user-1",
                type: "member",
                status: "active",
            },
            eventGameId: "hell_let_loose",
            recipientStatuses: new Set(["member"]),
            respondedUserIds: new Set(),
        }),
        true
    )
})

test("signup reminders exclude legacy memberships from non-HLL events", () => {
    assert.equal(
        isSignupReminderRecipient({
            assignment: {
                userId: "user-1",
                type: "member",
                status: "active",
            },
            eventGameId: "hell_let_loose_vietnam",
            recipientStatuses: new Set(["member"]),
            respondedUserIds: new Set(),
        }),
        false
    )
})
