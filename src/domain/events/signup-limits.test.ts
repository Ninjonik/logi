import assert from "node:assert/strict"
import test from "node:test"

import { isSignupGroupFull, signupGroupLimitFor } from "./signup-limits"
import type { EventParticipant } from "./types"

const at = "2026-10-05T10:00:00.000Z"
const participant = (
    userId: string,
    group: string | null,
    status: EventParticipant["status"] = "attending"
): EventParticipant => ({ userId, group, status, updatedAt: at })

test("a group without a cap is never full", () => {
    assert.equal(
        isSignupGroupFull({
            participants: [participant("a", "Tanks")],
            userId: "b",
            groupName: "Tanks",
            max: undefined,
        }),
        false
    )
})

test("a group is full once other attending players reach the cap", () => {
    const participants = [
        participant("a", "Tanks"),
        participant("b", "Tanks"),
        participant("c", "Infantry"),
        participant("d", "Tanks", "not_attending"),
    ]
    assert.equal(
        isSignupGroupFull({
            participants,
            userId: "e",
            groupName: "Tanks",
            max: 2,
        }),
        true
    )
    assert.equal(
        isSignupGroupFull({
            participants,
            userId: "e",
            groupName: "Tanks",
            max: 3,
        }),
        false
    )
})

test("a player already in the group keeps the place", () => {
    assert.equal(
        isSignupGroupFull({
            participants: [
                participant("a", "Tanks"),
                participant("b", "Tanks"),
            ],
            userId: "a",
            groupName: "Tanks",
            max: 2,
        }),
        false
    )
})

test("limits are looked up by group ID", () => {
    const limits = [{ groupId: "g1", max: 6 }]
    assert.equal(signupGroupLimitFor(limits, "g1"), 6)
    assert.equal(signupGroupLimitFor(limits, "g2"), undefined)
    assert.equal(signupGroupLimitFor(undefined, "g1"), undefined)
})
