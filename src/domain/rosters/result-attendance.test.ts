import { attendanceName, reconcileResultAttendance } from "./result-attendance"
import type { RosterLike } from "./types"
import assert from "node:assert/strict"
import test from "node:test"

test("normalizes clan tags, decorations, accents and case", () => {
    assert.equal(attendanceName("[TAG] Štěpán-CZ ★"), "stepancz")
    assert.equal(attendanceName("<TAG> Player (TAG)"), "player")
})

const roster: RosterLike = {
    squads: [
        {
            name: "A",
            group: "A",
            color: "red",
            order: 0,
            players: [
                { id: "a", ack: false },
                { id: "b", ack: true, confirmed: true },
                { id: "c", ack: true },
            ],
        },
    ],
    reservePlayerIds: ["r"],
    notAttendingPlayerIds: [],
    published: true,
}
const identities = [
    { userId: "a", logiUserId: "la", names: ["Štěpán CZ"] },
    { userId: "b", logiUserId: "lb", names: ["Admin"] },
    { userId: "c", logiUserId: "lc", names: ["Missing"] },
    { userId: "r", logiUserId: "lr", names: ["Reserve"] },
]
test("adds matched roster and reserve presence, keeps confirmed and missing players unchanged", () => {
    const evidence = [
        { key: "1", logiUserId: null, name: "[CLAN] stepan-cz" },
        { key: "2", logiUserId: "lr", name: "Other name" },
    ]
    const next = reconcileResultAttendance(roster, identities, evidence)
    assert.equal(next.squads[0].players[0].confirmed, true)
    assert.deepEqual(
        next.squads[0].players.slice(1),
        roster.squads[0].players.slice(1)
    )
    assert.equal(next.reserveAttendances?.[0].confirmed, true)
    assert.equal(roster.squads[0].players[0].confirmed, undefined)
    assert.equal(reconcileResultAttendance(next, identities, evidence), next)
})
test("skips ambiguous roster names, ambiguous match names, empty names and conflicting verified identities", () => {
    for (const [people, evidence] of [
        [
            [
                ...identities,
                { userId: "c", logiUserId: "lc", names: ["Stepan CZ"] },
            ],
            [{ key: "1", logiUserId: null, name: "Stepan CZ" }],
        ],
        [
            identities,
            [
                { key: "1", logiUserId: null, name: "Stepan CZ" },
                { key: "2", logiUserId: null, name: "Stepan CZ" },
            ],
        ],
        [
            identities,
            [{ key: "1", logiUserId: "someone-else", name: "Stepan CZ" }],
        ],
        [identities, [{ key: "1", logiUserId: null, name: "[TAG]" }]],
    ] as const)
        assert.equal(
            reconcileResultAttendance(roster, [...people], [...evidence]),
            roster
        )
})
