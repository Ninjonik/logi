import assert from "node:assert/strict"
import test from "node:test"

import {
    findEligibleNoticeTargets,
    findStartedNoticeEvent,
    upsertNotice,
} from "./notice-policy"

test("findEligibleNoticeTargets filters by game start, attending status, query, and caps results", () => {
    const results = findEligibleNoticeTargets({
        events: [
            {
                id: "event-1",
                name: "Match Alpha",
                gameStart: "2026-01-01T11:00:00.000Z",
                status: "starting",
                participants: [
                    {
                        userId: "user-1",
                        status: "attending",
                        updatedAt: "2026-01-01T08:00:00.000Z",
                    },
                ],
            },
            {
                id: "event-2",
                name: "Match Bravo",
                gameStart: "2026-01-01T11:05:00.000Z",
                status: "starting",
                participants: [
                    {
                        userId: "user-1",
                        status: "attending",
                        updatedAt: "2026-01-01T08:00:00.000Z",
                    },
                ],
            },
            {
                id: "event-3",
                name: "Match Charlie",
                gameStart: "2026-01-01T11:10:00.000Z",
                status: "starting",
                participants: [
                    {
                        userId: "user-1",
                        status: "attending",
                        updatedAt: "2026-01-01T08:00:00.000Z",
                    },
                ],
            },
            {
                id: "event-4",
                name: "Match Delta",
                gameStart: "2026-01-01T11:15:00.000Z",
                status: "starting",
                participants: [
                    {
                        userId: "user-1",
                        status: "attending",
                        updatedAt: "2026-01-01T08:00:00.000Z",
                    },
                ],
            },
            {
                id: "event-5",
                name: "Match Echo",
                gameStart: "2026-01-01T11:20:00.000Z",
                status: "starting",
                participants: [
                    {
                        userId: "user-1",
                        status: "attending",
                        updatedAt: "2026-01-01T08:00:00.000Z",
                    },
                ],
            },
            {
                id: "event-6",
                name: "Match Foxtrot",
                gameStart: "2026-01-01T11:25:00.000Z",
                status: "starting",
                participants: [
                    {
                        userId: "user-1",
                        status: "attending",
                        updatedAt: "2026-01-01T08:00:00.000Z",
                    },
                ],
            },
            {
                id: "event-7",
                name: "Too Early",
                gameStart: "2026-01-01T13:00:00.000Z",
                status: "registration",
                participants: [
                    {
                        userId: "user-1",
                        status: "attending",
                        updatedAt: "2026-01-01T08:00:00.000Z",
                    },
                ],
            },
            {
                id: "event-8",
                name: "Concluded Match",
                gameStart: "2026-01-01T11:10:00.000Z",
                status: "concluded",
                participants: [
                    {
                        userId: "user-1",
                        status: "attending",
                        updatedAt: "2026-01-01T08:00:00.000Z",
                    },
                ],
            },
            {
                id: "event-9",
                name: "Declined Match",
                gameStart: "2026-01-01T11:10:00.000Z",
                status: "starting",
                participants: [
                    {
                        userId: "user-1",
                        status: "not_attending",
                        updatedAt: "2026-01-01T08:00:00.000Z",
                    },
                ],
            },
            {
                id: "event-10",
                name: "Already Started",
                gameStart: "2026-01-01T10:00:00.000Z",
                status: "starting",
                participants: [
                    {
                        userId: "user-1",
                        status: "attending",
                        updatedAt: "2026-01-01T08:00:00.000Z",
                    },
                ],
            },
        ],
        userId: "user-1",
        query: "match",
        now: new Date("2026-01-01T10:30:00.000Z"),
    })

    assert.equal(results.length, 6)
    assert.deepEqual(
        results.map((event) => event.id),
        ["event-1", "event-2", "event-3", "event-4", "event-5", "event-6"]
    )
})

test("upsertNotice replaces an existing notice for the same user and trims the reason", () => {
    const notices = upsertNotice({
        event: {
            gameStart: "2026-01-01T11:00:00.000Z",
            status: "starting",
            participants: [
                {
                    userId: "user-1",
                    status: "attending",
                    updatedAt: "2026-01-01T08:00:00.000Z",
                },
            ],
            absenceNotices: [
                {
                    userId: "user-1",
                    reason: "Old",
                    createdAt: "2026-01-01T10:10:00.000Z",
                },
                {
                    userId: "user-2",
                    reason: "Keep",
                    createdAt: "2026-01-01T10:15:00.000Z",
                },
            ],
        },
        userId: "user-1",
        reason: "  New reason  ",
        now: new Date("2026-01-01T10:30:00.000Z"),
    })

    assert.deepEqual(notices, [
        {
            userId: "user-2",
            reason: "Keep",
            createdAt: "2026-01-01T10:15:00.000Z",
        },
        {
            userId: "user-1",
            reason: "New reason",
            createdAt: "2026-01-01T10:30:00.000Z",
            kind: "late",
        },
    ])
})

test("upsertNotice permits a reserve assigned without an event signup", () => {
    const notices = upsertNotice({
        event: {
            gameStart: "2026-01-01T11:00:00.000Z",
            status: "starting",
            participants: [],
            reservePlayerIds: ["user-1"],
            absenceNotices: [],
        },
        userId: "user-1",
        reason: "Unavailable",
        now: new Date("2026-01-01T10:30:00.000Z"),
    })

    assert.equal(notices[0]?.userId, "user-1")
})

test("upsertNotice rejects invalid time windows and non-attending users", () => {
    assert.throws(
        () =>
            upsertNotice({
                event: {
                    gameStart: "2026-01-01T10:00:00.000Z",
                    status: "starting",
                    participants: [
                        {
                            userId: "user-1",
                            status: "attending",
                            updatedAt: "2026-01-01T08:00:00.000Z",
                        },
                    ],
                    absenceNotices: [],
                },
                userId: "user-1",
                reason: "Late",
                now: new Date("2026-01-01T10:30:00.000Z"),
            }),
        /before game start/
    )

    assert.throws(
        () =>
            upsertNotice({
                event: {
                    gameStart: "2026-01-01T11:00:00.000Z",
                    status: "concluded",
                    participants: [
                        {
                            userId: "user-1",
                            status: "attending",
                            updatedAt: "2026-01-01T08:00:00.000Z",
                        },
                    ],
                    absenceNotices: [],
                },
                userId: "user-1",
                reason: "Late",
                now: new Date("2026-01-01T10:30:00.000Z"),
            }),
        /already concluded/
    )

    assert.throws(
        () =>
            upsertNotice({
                event: {
                    gameStart: "2026-01-01T11:00:00.000Z",
                    status: "starting",
                    participants: [
                        {
                            userId: "user-1",
                            status: "not_attending",
                            updatedAt: "2026-01-01T08:00:00.000Z",
                        },
                    ],
                    absenceNotices: [],
                },
                userId: "user-1",
                reason: "Late",
                now: new Date("2026-01-01T10:30:00.000Z"),
            }),
        /Only attending players/
    )
})

test("findStartedNoticeEvent finds the person's started event so /notice can say it began (M3-19)", () => {
    const attending = (userId: string) => [
        {
            userId,
            status: "attending" as const,
            updatedAt: "2026-10-11T08:00:00.000Z",
        },
    ]
    const events = [
        {
            id: "old",
            name: "VLK vs ROG",
            gameStart: "2026-09-20T18:00:00.000Z",
            status: "concluded" as const,
            participants: attending("user-1"),
        },
        {
            id: "started",
            name: "VLK vs ROG",
            gameStart: "2026-10-11T18:00:00.000Z",
            status: "starting" as const,
            participants: attending("user-1"),
        },
        {
            id: "upcoming",
            name: "VLK vs ROG",
            gameStart: "2026-10-12T18:00:00.000Z",
            status: "registration" as const,
            participants: attending("user-1"),
        },
        {
            id: "reserve",
            name: "Trénink obrany",
            gameStart: "2026-10-11T17:00:00.000Z",
            status: "starting" as const,
            participants: [],
            reservePlayerIds: ["user-1"],
        },
        {
            id: "declined",
            name: "Liga",
            gameStart: "2026-10-11T17:00:00.000Z",
            status: "starting" as const,
            participants: [
                {
                    userId: "user-1",
                    status: "not_attending" as const,
                    updatedAt: "2026-10-11T08:00:00.000Z",
                },
            ],
        },
    ]
    const now = new Date("2026-10-11T18:05:00.000Z")
    const find = (query: string, userId = "user-1") =>
        findStartedNoticeEvent({ events, userId, query, now })
    // The most recent started match of the name; never the upcoming one.
    assert.deepEqual(find("vlk vs rog"), {
        id: "started",
        name: "VLK vs ROG",
        gameStart: "2026-10-11T18:00:00.000Z",
    })
    // A value picked from the autocomplete before the start is the ID.
    assert.equal(find("old")?.id, "old")
    assert.equal(find("Trénink")?.id, "reserve")
    assert.equal(find("Liga"), null, "not signed up")
    assert.equal(find("VLK", "user-2"), null, "someone else's sign-up")
    assert.equal(find("upcoming"), null, "not started yet")
    assert.equal(find("  "), null)
})
