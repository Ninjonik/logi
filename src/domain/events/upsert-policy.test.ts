import assert from "node:assert/strict"
import test from "node:test"

import type { MatchTeamAssignment } from "@/domain/teams/match-teams"

import {
    buildCreateEventRecord,
    buildEventBasePayload,
    buildUpdateEventPatch,
    type EventUpsertInput,
} from "./upsert-policy"

const now = new Date("2026-10-04T12:00:00.000Z")
const input: EventUpsertInput = {
    guildId: "guild-a",
    gameId: "hell_let_loose",
    kind: "match",
    name: "Fixture match",
    registrationEnd: "2030-01-01T17:00:00.000Z",
    meetingStart: "2030-01-01T18:00:00.000Z",
    gameStart: "2030-01-01T18:30:00.000Z",
    gameEnd: "2030-01-01T20:00:00.000Z",
    pingClan: false,
}
const assignment: MatchTeamAssignment = {
    teamId: "teamDirectory:alpha",
    slot: "a",
    side: "Allies",
    snapshot: {
        name: "Alpha",
        shortCode: "ALP",
        logoAssetId: "imageAssets:logo",
        logoUrl: "https://logi.test/api/image-assets/logo.png",
        teamRevision: 1,
        capturedAt: "2026-10-04T11:00:00.000Z",
    },
}

test("base payload never carries match teams; create stores only resolved assignments", () => {
    assert.equal("matchTeams" in buildEventBasePayload(input), false)
    assert.equal(
        "matchTeams" in buildCreateEventRecord(input, now),
        false,
        "a create without assignments stays a legacy-shaped record"
    )
    const created = buildCreateEventRecord(
        { ...input, matchTeams: [assignment] },
        now
    )
    assert.deepEqual(created.matchTeams, [assignment])
    assert.deepEqual(
        buildCreateEventRecord({ ...input, matchTeams: [] }, now).matchTeams,
        []
    )
})

test("update preserves saved assignments when omitted and clears them with an explicit empty list", () => {
    const existing = {
        ...input,
        status: "registration" as const,
        matchTeams: [assignment],
    }
    const preserved = buildUpdateEventPatch(existing, input, now)
    assert.deepEqual(preserved.matchTeams, [assignment])
    const replaced = buildUpdateEventPatch(
        existing,
        { ...input, matchTeams: [{ ...assignment, slot: "b", side: null }] },
        now
    )
    assert.deepEqual(replaced.matchTeams, [
        { ...assignment, slot: "b", side: null },
    ])
    const cleared = buildUpdateEventPatch(
        existing,
        { ...input, matchTeams: [] },
        now
    )
    assert.deepEqual(cleared.matchTeams, [])
    const legacy = buildUpdateEventPatch(
        { ...input, status: "registration" },
        input,
        now
    )
    assert.equal(legacy.matchTeams, undefined)
})
