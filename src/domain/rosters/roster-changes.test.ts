import assert from "node:assert/strict"
import test from "node:test"

import { countRosterChanges } from "./roster-changes"
import type { RosterLike } from "./types"

const saved: RosterLike = {
    squads: [
        {
            name: "Able",
            group: "Infantry",
            order: 0,
            color: "#f00",
            players: [
                { id: "a", ack: true, roleName: "SL" },
                { ack: false, roleName: "Medic" },
            ],
        },
    ],
    reservePlayerIds: ["b", "c"],
    notAttendingPlayerIds: ["d"],
    published: false,
}

test("an unchanged roster has no changes", () => {
    assert.equal(countRosterChanges(saved, structuredClone(saved)), 0)
})

test("moving a reserve into a free slot counts the slot and the reserve", () => {
    const draft = structuredClone(saved)
    draft.squads[0]!.players[1]!.id = "b"
    draft.reservePlayerIds = ["c"]
    assert.equal(countRosterChanges(saved, draft), 2)
})

test("squad edits, added slots and list moves each count once", () => {
    const draft = structuredClone(saved)
    draft.squads[0]!.name = "Baker"
    draft.squads[0]!.players.push({ ack: false, roleName: "Rifleman" })
    draft.notAttendingPlayerIds = []
    draft.squadPresetId = "preset"
    assert.equal(countRosterChanges(saved, draft), 4)
})

test("missing rosters compare as equal only when both are missing", () => {
    assert.equal(countRosterChanges(undefined, undefined), 0)
    assert.equal(countRosterChanges(saved, undefined), 1)
})
