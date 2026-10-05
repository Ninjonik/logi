import assert from "node:assert/strict"
import test from "node:test"

import {
    changedRecipients,
    countRosterPlayerChanges,
    diffRosterPlaces,
    placesToSnapshot,
    rosterPlaces,
    snapshotToPlaces,
} from "./roster-update-summary"

const before = rosterPlaces({
    squads: [
        {
            name: "F1",
            players: [
                { id: "rex", roleName: "Squad Leader" },
                { id: "zubr", roleName: "Anti-Tank" },
                { id: "orech", roleName: "Rifleman" },
            ],
        },
        {
            name: "F2",
            players: [
                { id: "krtek", roleName: "Anti-Tank" },
                { id: "mrak", roleName: "" },
            ],
        },
    ],
})

const after = rosterPlaces({
    squads: [
        {
            name: "F1",
            players: [
                { id: "rex", roleName: "Squad Leader" },
                { id: "krtek", roleName: "Anti-Tank" },
                { id: "stekot", roleName: "Rifleman" },
            ],
        },
        {
            name: "F2",
            players: [
                { id: "orech", roleName: "Anti-Tank" },
                { id: "mrak", roleName: "Support" },
            ],
        },
    ],
})

test("every changed player is listed once: added, moved or re-roled, removed", () => {
    const changes = diffRosterPlaces(before, after, ["zubr"])
    assert.deepEqual(
        changes.map((change) => [
            change.userId,
            change.added,
            change.moved,
            change.roleChanged,
            change.removed,
            change.toReserves,
        ]),
        [
            ["stekot", true, false, false, false, false],
            ["krtek", false, true, false, false, false],
            ["orech", false, true, true, false, false],
            ["mrak", false, false, true, false, false],
            ["zubr", false, false, false, true, true],
        ]
    )
    assert.deepEqual(changes[2]!.before, { squad: "F1", role: "Rifleman" })
    assert.deepEqual(changes[2]!.after, { squad: "F2", role: "Anti-Tank" })
    // A slot without a role has none, never "Unassigned".
    assert.deepEqual(changes[3]!.before, { squad: "F2" })
})

test("the dialog chips count added, removed and moved or re-roled players", () => {
    assert.deepEqual(
        countRosterPlayerChanges(diffRosterPlaces(before, after)),
        {
            added: 1,
            removed: 1,
            moved: 3,
        }
    )
    assert.deepEqual(diffRosterPlaces(after, after), [])
})

test("only clan members get a change DM", () => {
    const changes = diffRosterPlaces(before, after)
    assert.deepEqual(
        changedRecipients(changes, new Set(["krtek", "zubr", "rex"])),
        ["krtek", "zubr"]
    )
})

test("a stored snapshot round-trips and the first slot of a duplicate wins", () => {
    const places = rosterPlaces({
        squads: [
            {
                name: " F1 ",
                players: [
                    { id: "a", roleName: "Medic" },
                    { id: "a", roleName: "Rifleman" },
                    { id: null },
                ],
            },
        ],
    })
    assert.deepEqual(places, { a: { squad: "F1", role: "Medic" } })
    assert.deepEqual(snapshotToPlaces(placesToSnapshot(places)), places)
})
