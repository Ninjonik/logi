import assert from "node:assert/strict"
import test from "node:test"

import { projectEventSummary, projectMatchSummary } from "./event-summaries"

test("legacy events retain explicit HLL identity and unknown optional schedule/result data", () => {
    const event = {
        _id: "legacy-event",
        guildId: "fixture-guild",
        name: "Legacy fixture",
        gameEnd: "2030-01-01T02:00:00.000Z",
    }
    const identity = {
        id: "legacy-event",
        guildId: "fixture-guild",
        gameId: "hell_let_loose",
        title: "Legacy fixture",
        updatedAt: null,
    }
    assert.deepEqual(projectEventSummary(event), {
        ...identity,
        kind: "match",
        status: null,
        startsAt: null,
        endsAt: "2030-01-01T02:00:00.000Z",
    })
    assert.deepEqual(projectMatchSummary(event), {
        ...identity,
        eventId: "legacy-event",
        resultState: "unknown",
        result: null,
    })
})
