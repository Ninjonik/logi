import assert from "node:assert/strict"
import test from "node:test"

import {
    AttendanceDeclineRejected,
    declineRosterAttendance,
    findRosterPlacement,
} from "./attendance-decline"
import type { RosterLike } from "./types"

const now = new Date("2026-10-10T18:00:00.000Z")
const roster: RosterLike = {
    published: true,
    squads: [
        {
            name: "Able",
            group: "inf",
            order: 1,
            color: "#000",
            players: [
                { id: "medic", ack: true, roleName: "Medic" },
                { id: "rifle", ack: false },
            ],
        },
    ],
    reservePlayerIds: ["reserve"],
    reserveAttendances: [{ userId: "reserve", ack: true, confirmed: false }],
    notAttendingPlayerIds: [],
}
const event = {
    gameStart: "2026-10-11T18:00:00.000Z",
    status: "starting" as const,
    absenceNotices: [
        { userId: "other", reason: "late", createdAt: now.toISOString() },
    ],
}

function rejection(run: () => unknown) {
    try {
        run()
    } catch (error) {
        return error instanceof AttendanceDeclineRejected ? error.code : error
    }
    return null
}

test("declining records a notice, withdraws the confirmation and keeps the slot", () => {
    const result = declineRosterAttendance({
        roster,
        event,
        userId: "medic",
        reason: "  Nemoc  ",
        now,
    })

    assert.equal(result.changed, true)
    assert.deepEqual(result.placement, {
        kind: "slot",
        squadName: "Able",
        roleName: "Medic",
    })
    assert.deepEqual(result.absenceNotices, [
        event.absenceNotices[0],
        { userId: "medic", reason: "Nemoc", createdAt: now.toISOString() },
    ])
    const medic = result.roster.squads[0]?.players[0]
    assert.deepEqual(medic, {
        id: "medic",
        ack: false,
        confirmed: false,
        roleName: "Medic",
    })
    assert.equal(result.roster.squads[0]?.players.length, 2)
})

test("repeating the same decline changes nothing; a new reason replaces the notice", () => {
    const first = declineRosterAttendance({
        roster,
        event,
        userId: "medic",
        reason: "Nemoc",
        now,
    })
    const again = declineRosterAttendance({
        roster: first.roster,
        event: { ...event, absenceNotices: first.absenceNotices },
        userId: "medic",
        reason: "Nemoc",
        now: new Date("2026-10-10T19:00:00.000Z"),
    })
    assert.equal(again.changed, false)
    assert.deepEqual(again.absenceNotices, first.absenceNotices)

    const changedReason = declineRosterAttendance({
        roster: first.roster,
        event: { ...event, absenceNotices: first.absenceNotices },
        userId: "medic",
        reason: "Práce",
        now,
    })
    assert.equal(changedReason.changed, true)
    assert.deepEqual(
        changedReason.absenceNotices.filter(
            (notice) => notice.userId === "medic"
        ),
        [{ userId: "medic", reason: "Práce", createdAt: now.toISOString() }]
    )
})

test("a running-late notice followed by a decline is a change", () => {
    const result = declineRosterAttendance({
        roster,
        event: {
            ...event,
            absenceNotices: [
                { userId: "rifle", reason: "20:30", createdAt: "x" },
            ],
        },
        userId: "rifle",
        reason: "Nemůže přijít",
        now,
    })
    assert.equal(result.changed, true)
    assert.deepEqual(result.absenceNotices, [
        {
            userId: "rifle",
            reason: "Nemůže přijít",
            createdAt: now.toISOString(),
        },
    ])
})

test("reserves can decline; their attendance becomes pending", () => {
    const result = declineRosterAttendance({
        roster,
        event,
        userId: "reserve",
        reason: "Nemůže přijít",
        now,
    })
    assert.deepEqual(result.placement, { kind: "reserve" })
    assert.deepEqual(result.roster.reserveAttendances, [
        { userId: "reserve", ack: false, confirmed: false },
    ])
})

test("declining is refused off the roster, before publication, after the start or without a reason", () => {
    const decline = (patch: {
        userId?: string
        reason?: string
        roster?: RosterLike
        event?: typeof event | { gameStart: string; status: "concluded" }
        now?: Date
    }) =>
        rejection(() =>
            declineRosterAttendance({
                roster: patch.roster ?? roster,
                event: patch.event ?? event,
                userId: patch.userId ?? "rifle",
                reason: patch.reason ?? "Nemoc",
                now: patch.now ?? now,
            })
        )

    assert.equal(decline({}), null)
    assert.equal(decline({ userId: "stranger" }), "not_on_roster")
    assert.equal(
        decline({ roster: { ...roster, published: false } }),
        "roster_not_published"
    )
    assert.equal(
        decline({ now: new Date("2026-10-11T18:00:00.000Z") }),
        "too_late"
    )
    assert.equal(
        decline({
            event: { gameStart: event.gameStart, status: "concluded" },
        }),
        "too_late"
    )
    assert.equal(decline({ reason: "   " }), "invalid_reason")
    assert.equal(decline({ reason: "x".repeat(501) }), "invalid_reason")
})

test("roster placement names the squad and role or the reserves", () => {
    assert.deepEqual(findRosterPlacement(roster, "rifle"), {
        kind: "slot",
        squadName: "Able",
    })
    assert.deepEqual(findRosterPlacement(roster, "reserve"), {
        kind: "reserve",
    })
    assert.equal(findRosterPlacement(roster, "nobody"), null)
})
