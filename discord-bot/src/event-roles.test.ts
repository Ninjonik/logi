import assert from "node:assert/strict"
import test from "node:test"

import { eventRoleName } from "./event-roles"

const snapshot = (name: string, shortCode: string) => ({
    name,
    shortCode,
    logoAssetId: null,
    logoUrl: null,
    teamRevision: 1,
    capturedAt: "",
})

const event = {
    name: "Liga 4",
    matchTeams: [
        {
            teamId: "a",
            slot: "a" as const,
            side: "Allies",
            snapshot: snapshot("Vlci", "VLK"),
        },
        {
            teamId: "b",
            slot: "b" as const,
            side: "Axis",
            snapshot: snapshot("Rogue", "ROG"),
        },
    ],
}

test("match roles are named after the match with the suffix in the clan language", () => {
    assert.equal(eventRoleName(event, "players", "cs"), "VLK vs ROG · Hráči")
    assert.equal(eventRoleName(event, "reserves", "cs"), "VLK vs ROG · Zálohy")
    assert.equal(eventRoleName(event, "players", "en"), "VLK vs ROG · Players")
    assert.equal(
        eventRoleName({ name: "Trénink obrany" }, "reserves", "de"),
        "Trénink obrany · Reserve"
    )
    assert.ok(
        eventRoleName({ name: "x".repeat(200) }, "players", "cs").length <= 100
    )
})
