import assert from "node:assert/strict"
import test from "node:test"

import { buildMatchAttendance, setRosterPresence } from "./match-attendance"
import type { RosterLike } from "./types"

const roster: RosterLike = {
    squads: [
        {
            name: "Able",
            group: "Infantry",
            order: 1,
            color: "#000",
            players: [
                { id: "sl", ack: true, confirmed: true, roleName: "SL" },
                { id: "at", ack: false, confirmed: false, roleName: "AT" },
                { ack: false, customName: "Guest" },
            ],
        },
        {
            name: "Command",
            group: "Command",
            order: 0,
            color: "#000",
            players: [{ id: "cmd", ack: true, confirmed: false }],
        },
    ],
    reservePlayerIds: ["res1", "res2"],
    reserveAttendances: [{ userId: "res1", ack: true, confirmed: true }],
    notAttendingPlayerIds: [],
    published: true,
}

test("lists roster players in squad order, then reserves, with their marks", () => {
    const attendance = buildMatchAttendance({
        roster,
        participants: [
            { userId: "sl", status: "attending" },
            { userId: "cmd", status: "attending" },
            { userId: "at", status: "attending" },
            { userId: "res1", status: "attending" },
            { userId: "res2", status: "attending" },
            { userId: "no", status: "not_attending" },
        ],
        notices: [{ userId: "cmd", reason: "Late, 20:20" }],
        memberIds: ["sl", "cmd", "at", "res1", "res2", "no", "quiet"],
    })

    assert.deepEqual(
        attendance.entries.map((entry) => [entry.userId, entry.mark]),
        [
            ["cmd", "excused"],
            ["sl", "present"],
            ["at", "absent"],
            ["res1", "present"],
            ["res2", "absent"],
        ]
    )
    assert.deepEqual(attendance.entries[0]?.before, {
        kind: "notice",
        reason: "Late, 20:20",
    })
    assert.deepEqual(attendance.entries[1]?.placement, {
        kind: "slot",
        squadName: "Able",
        roleName: "SL",
    })
    assert.deepEqual(attendance.entries[2]?.before, { kind: "pending" })
    assert.deepEqual(attendance.entries[4]?.before, { kind: "reserve" })
    assert.deepEqual(attendance.declinedUserIds, ["no"])
    assert.deepEqual(attendance.noResponseUserIds, ["quiet"])
    assert.deepEqual(attendance.counts, {
        roster: { present: 1, excused: 1, absent: 1, total: 3 },
        reserves: { present: 1, excused: 0, absent: 1, total: 2 },
        declined: 1,
        noResponse: 1,
    })
})

test("works without a roster", () => {
    const attendance = buildMatchAttendance({
        roster: null,
        participants: [{ userId: "a", status: "attending" }],
        notices: [],
        memberIds: ["a", "b", "b"],
    })
    assert.deepEqual(attendance.entries, [])
    assert.deepEqual(attendance.noResponseUserIds, ["b"])
})

test("setRosterPresence confirms and clears presence, keeping acknowledgements", () => {
    const absent = setRosterPresence(roster, "sl", false)
    assert.deepEqual(absent.squads[0]?.players[0], {
        id: "sl",
        ack: true,
        confirmed: false,
        roleName: "SL",
    })
    const present = setRosterPresence(roster, "at", true)
    assert.equal(present.squads[0]?.players[1]?.confirmed, true)
    const reserve = setRosterPresence(roster, "res2", true)
    assert.deepEqual(reserve.reserveAttendances?.at(-1), {
        userId: "res2",
        ack: true,
        confirmed: true,
    })
    assert.throws(() => setRosterPresence(roster, "stranger", true))
})
