import assert from "node:assert/strict"
import test from "node:test"

import { eventsBlockingTopicPresetDeletion } from "./preset-deletion"

const now = new Date("2026-10-05T12:00:00.000Z")
const upcoming = {
    status: "registration" as const,
    registrationEnd: "2026-10-10T18:00:00.000Z",
    meetingStart: "2026-10-11T19:30:00.000Z",
    gameEnd: "2026-10-11T21:30:00.000Z",
}

test("an upcoming event that uses the preset blocks its deletion", () => {
    const blocking = eventsBlockingTopicPresetDeletion(
        [{ ...upcoming, topicPresetId: "p1" }],
        "p1",
        now
    )
    assert.equal(blocking.length, 1)
})

test("other presets and concluded events do not block", () => {
    const events = [
        { ...upcoming, topicPresetId: "p2" },
        { ...upcoming, topicPresetId: "p1", status: "concluded" as const },
        { ...upcoming },
    ]
    assert.deepEqual(eventsBlockingTopicPresetDeletion(events, "p1", now), [])
})

test("an event past its end reads as concluded before the bot records it", () => {
    const blocking = eventsBlockingTopicPresetDeletion(
        [
            {
                topicPresetId: "p1",
                status: "starting" as const,
                registrationEnd: "2026-09-01T18:00:00.000Z",
                meetingStart: "2026-09-02T19:30:00.000Z",
                gameEnd: "2026-09-02T21:30:00.000Z",
            },
        ],
        "p1",
        now
    )
    assert.deepEqual(blocking, [])
})
