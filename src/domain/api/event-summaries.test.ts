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
        matchTeams: null,
    })
    assert.deepEqual(projectMatchSummary(event), {
        ...identity,
        eventId: "legacy-event",
        resultState: "unknown",
        result: null,
        matchTeams: null,
    })
})

test("summaries expose selected team snapshots by slot without asset identifiers; trainings read null", () => {
    const snapshot = {
        name: "Bravo",
        shortCode: null,
        logoAssetId: "imageAssets:private",
        logoUrl: "https://logi.test/api/image-assets/b.png",
        teamRevision: 3,
        capturedAt: "2026-10-04T10:00:00.000Z",
    }
    const event = {
        _id: "event",
        guildId: "fixture-guild",
        gameId: "wardogs" as const,
        kind: "match" as const,
        name: "Fixture",
        gameEnd: "2030-01-01T02:00:00.000Z",
        matchTeams: [
            {
                teamId: "teamDirectory:bravo",
                slot: "b" as const,
                side: null,
                snapshot,
            },
            {
                teamId: "teamDirectory:alpha",
                slot: "a" as const,
                side: "Valkyra",
                snapshot: { ...snapshot, name: "Alpha", shortCode: "ALP" },
            },
        ],
    }
    const expected = [
        {
            teamId: "teamDirectory:alpha",
            slot: "a",
            side: "Valkyra",
            name: "Alpha",
            shortCode: "ALP",
            logoUrl: snapshot.logoUrl,
            teamRevision: 3,
            capturedAt: snapshot.capturedAt,
        },
        {
            teamId: "teamDirectory:bravo",
            slot: "b",
            side: null,
            name: "Bravo",
            shortCode: null,
            logoUrl: snapshot.logoUrl,
            teamRevision: 3,
            capturedAt: snapshot.capturedAt,
        },
    ]
    assert.deepEqual(projectEventSummary(event).matchTeams, expected)
    assert.deepEqual(projectMatchSummary(event).matchTeams, expected)
    assert.equal(
        JSON.stringify(projectMatchSummary(event)).includes("logoAssetId"),
        false
    )
    assert.deepEqual(
        projectEventSummary({ ...event, matchTeams: [] }).matchTeams,
        []
    )
    assert.equal(
        projectEventSummary({ ...event, kind: "training" }).matchTeams,
        null
    )
})
