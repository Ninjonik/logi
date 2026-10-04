import assert from "node:assert/strict"
import test from "node:test"

import { normalizeEventRecord } from "./normalization"

test("normalizeEventRecord derives current status instead of trusting stale stored status", () => {
    const normalized = normalizeEventRecord(
        {
            registrationEnd: "2026-08-12T17:50:00.000Z",
            meetingStart: "2026-08-12T17:51:00.000Z",
            gameEnd: "2026-08-12T19:00:00.000Z",
            status: "registration",
        },
        new Date("2026-08-12T17:52:00.000Z")
    )

    assert.equal(normalized.status, "starting")
})

test("normalizeEventRecord keeps stored match team assignments untouched", () => {
    const matchTeams = [
        {
            teamId: "teamDirectory:alpha",
            slot: "a" as const,
            side: null,
            snapshot: {
                name: "Alpha",
                shortCode: null,
                logoAssetId: null,
                logoUrl: null,
                teamRevision: 1,
                capturedAt: "2026-10-04T10:00:00.000Z",
            },
        },
    ]
    const normalized = normalizeEventRecord({
        registrationEnd: "2030-01-01T17:00:00.000Z",
        meetingStart: "2030-01-01T18:00:00.000Z",
        gameEnd: "2030-01-01T20:00:00.000Z",
        matchTeams,
    })
    assert.deepEqual(normalized.matchTeams, matchTeams)
    assert.equal(
        "matchTeams" in
            normalizeEventRecord({
                registrationEnd: "2030-01-01T17:00:00.000Z",
                meetingStart: "2030-01-01T18:00:00.000Z",
                gameEnd: "2030-01-01T20:00:00.000Z",
            }),
        false
    )
})
