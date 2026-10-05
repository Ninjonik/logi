import assert from "node:assert/strict"
import test from "node:test"

import { eventDraftSchema, eventPublishSchema } from "./event-flow"

const body = {
    gameId: "hell_let_loose",
    kind: "match",
    name: "VLK vs ROG · Friendly",
    registrationEnd: "2026-10-10T17:30:00.000Z",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
    gameEnd: "2026-10-11T19:30:00.000Z",
    pingClan: true,
    pingMode: "clan",
    signupGroupIds: ["g1"],
    signupGroupLimits: [{ groupId: "g1", max: 6 }],
    attendanceReminderHours: [24, 12],
    createParticipantRoles: false,
}

test("a complete flow body publishes", () => {
    assert.ok(eventPublishSchema.safeParse(body).success)
})

test("a draft may be untitled, a published match may not", () => {
    const untitled = { ...body, name: "" }
    assert.ok(eventDraftSchema.safeParse(untitled).success)
    assert.equal(eventPublishSchema.safeParse(untitled).success, false)
})

test("a published match needs a coherent timeline", () => {
    const late = { ...body, registrationEnd: "2026-10-12T00:00:00.000Z" }
    assert.ok(eventDraftSchema.safeParse(late).success)
    assert.equal(eventPublishSchema.safeParse(late).success, false)
})

test("unknown fields, bad caps and unsupported reminders are refused", () => {
    for (const bad of [
        { ...body, isDraft: false },
        { ...body, guildId: "other" },
        { ...body, signupGroupLimits: [{ groupId: "g1", max: 0 }] },
        { ...body, attendanceReminderHours: [3] },
        { ...body, registrationEnd: "soon" },
    ])
        assert.equal(
            eventDraftSchema.safeParse(bad).success,
            false,
            JSON.stringify(bad)
        )
})
