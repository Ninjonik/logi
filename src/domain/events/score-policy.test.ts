import assert from "node:assert/strict"
import test from "node:test"

import {
    resolveRosterScoreCategory,
    resolveRosterScoreDelta,
    summarizeRosterScoreChanges,
    type RosterScoreSettings,
} from "./score-policy"

const settings: RosterScoreSettings = {
    noCategory: 0,
    declined: 1,
    rosterPresent: 5,
    reservePresent: 3,
    rosterAbsent: -2,
    reserveAbsent: -1,
    excusedAbsence: 2,
}

test("resolveRosterScoreDelta returns declined score for explicit decline", () => {
    assert.equal(
        resolveRosterScoreDelta({
            userId: "user-1",
            settings,
            participants: [{ userId: "user-1", status: "not_attending" }],
            notices: [],
            roster: null,
        }),
        1
    )
})

test("resolveRosterScoreDelta returns confirmed roster score for rostered confirmed attendee", () => {
    assert.equal(
        resolveRosterScoreDelta({
            userId: "user-1",
            settings,
            participants: [{ userId: "user-1", status: "attending" }],
            notices: [],
            roster: {
                squads: [{ players: [{ id: "user-1", confirmed: true }] }],
                reservePlayerIds: [],
                reserveAttendances: [],
            },
        }),
        5
    )
})

test("resolveRosterScoreDelta returns excused absence score before absence penalties", () => {
    assert.equal(
        resolveRosterScoreDelta({
            userId: "user-1",
            settings,
            participants: [{ userId: "user-1", status: "attending" }],
            notices: [{ userId: "user-1" }],
            roster: {
                squads: [{ players: [{ id: "user-1", confirmed: false }] }],
                reservePlayerIds: [],
                reserveAttendances: [],
            },
        }),
        2
    )
})

test("resolveRosterScoreDelta returns reserve absence score for unconfirmed reserve attendee", () => {
    assert.equal(
        resolveRosterScoreDelta({
            userId: "user-1",
            settings,
            participants: [{ userId: "user-1", status: "attending" }],
            notices: [],
            roster: {
                squads: [{ players: [] }],
                reservePlayerIds: ["user-1"],
                reserveAttendances: [{ userId: "user-1", confirmed: false }],
            },
        }),
        -1
    )
})

test("summarizeRosterScoreChanges groups the scored members per rule (K4 example)", () => {
    const k4Settings: RosterScoreSettings = {
        noCategory: 0,
        declined: -1,
        rosterPresent: 3,
        reservePresent: 1,
        rosterAbsent: -2,
        reserveAbsent: 0,
        excusedAbsence: 0,
    }
    const rostered = Array.from({ length: 21 }, (_, index) => `r${index}`)
    const summary = summarizeRosterScoreChanges({
        userIds: [...rostered, "res1", "res2", "d1", "d2", "d3", "quiet"],
        settings: k4Settings,
        participants: [
            ...rostered.map((userId) => ({
                userId,
                status: "attending" as const,
            })),
            { userId: "res1", status: "attending" },
            { userId: "res2", status: "attending" },
            { userId: "d1", status: "not_attending" },
            { userId: "d2", status: "not_attending" },
            { userId: "d3", status: "not_attending" },
        ],
        notices: [{ userId: "r19" }],
        roster: {
            squads: [
                {
                    players: rostered.map((id, index) => ({
                        id,
                        confirmed: index < 19,
                    })),
                },
            ],
            reservePlayerIds: ["res1", "res2"],
            reserveAttendances: [
                { userId: "res1", confirmed: true },
                { userId: "res2", confirmed: false },
            ],
        },
    })

    assert.deepEqual(summary.rows, [
        { category: "rosterPresent", count: 19, delta: 3 },
        { category: "reservePresent", count: 1, delta: 1 },
        { category: "excusedAbsence", count: 1, delta: 0 },
        { category: "rosterAbsent", count: 1, delta: -2 },
        { category: "reserveAbsent", count: 1, delta: 0 },
        { category: "declined", count: 3, delta: -1 },
        { category: "noCategory", count: 1, delta: 0 },
    ])
    assert.equal(summary.changedCount, 24)
})

test("summarizeRosterScoreChanges counts each member once and skips empty rules", () => {
    const summary = summarizeRosterScoreChanges({
        userIds: ["a", "a", "b"],
        settings,
        participants: [{ userId: "a", status: "not_attending" }],
        notices: [],
        roster: null,
    })
    assert.deepEqual(summary.rows, [
        { category: "declined", count: 1, delta: 1 },
        { category: "noCategory", count: 1, delta: 0 },
    ])
    assert.equal(summary.changedCount, 1)
})

test("resolveRosterScoreCategory and resolveRosterScoreDelta agree", () => {
    const input = {
        userId: "user-1",
        participants: [{ userId: "user-1", status: "attending" as const }],
        notices: [],
        roster: {
            squads: [{ players: [{ id: "user-1", confirmed: false }] }],
            reservePlayerIds: [],
        },
    }
    assert.equal(resolveRosterScoreCategory(input), "rosterAbsent")
    assert.equal(
        resolveRosterScoreDelta({ ...input, settings }),
        settings.rosterAbsent
    )
})

test("resolveRosterScoreDelta scores a reserve assigned without an event signup", () => {
    assert.equal(
        resolveRosterScoreDelta({
            userId: "user-1",
            settings,
            participants: [],
            notices: [{ userId: "user-1" }],
            roster: {
                squads: [{ players: [] }],
                reservePlayerIds: ["user-1"],
                reserveAttendances: [{ userId: "user-1", confirmed: false }],
            },
        }),
        2
    )
})
