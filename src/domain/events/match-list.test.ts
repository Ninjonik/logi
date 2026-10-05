import assert from "node:assert/strict"
import test from "node:test"

import {
    groupByWeek,
    isPlayed,
    localDayNumber,
    matchListPhase,
    matchListQueue,
    weekOffset,
    type MatchListEvent,
    type MatchListRoster,
} from "./match-list"

// Monday 5 October 2026, 12:00 UTC.
const now = new Date("2026-10-05T12:00:00.000Z")

function event(overrides: Partial<MatchListEvent> = {}): MatchListEvent {
    return {
        id: "e1",
        kind: "match",
        status: "registration",
        registrationEnd: "2026-10-10T17:30:00.000Z",
        meetingStart: "2026-10-11T17:30:00.000Z",
        gameStart: "2026-10-11T18:00:00.000Z",
        gameEnd: "2026-10-11T19:30:00.000Z",
        participants: [
            { status: "attending" },
            { status: "attending" },
            { status: "not_attending" },
        ],
        ...overrides,
    }
}

// Registration closed on Saturday; the match is on Sunday.
const closed = event({
    status: "closed",
    registrationEnd: "2026-10-04T17:30:00.000Z",
    meetingStart: "2026-10-06T17:30:00.000Z",
    gameStart: "2026-10-06T18:00:00.000Z",
    gameEnd: "2026-10-06T19:30:00.000Z",
})

function roster(
    published: boolean,
    players: MatchListRoster["squads"][number]["players"]
): MatchListRoster {
    return { eventId: "e1", published, squads: [{ players }] }
}

test("open sign-ups show when they close", () => {
    assert.deepEqual(matchListPhase(event(), undefined, now), {
        kind: "registration",
        closesAt: "2026-10-10T17:30:00.000Z",
    })
})

test("after sign-ups close a match needs a published roster", () => {
    assert.deepEqual(matchListPhase(closed, undefined, now), {
        kind: "rosterMissing",
    })
    assert.deepEqual(
        matchListPhase(
            closed,
            roster(false, [
                { id: "u1", ack: false },
                { ack: false },
                { customName: "Guest", ack: false },
            ]),
            now
        ),
        { kind: "rosterDraft", openSlots: 1 }
    )
    assert.deepEqual(
        matchListPhase(
            closed,
            roster(true, [
                { id: "u1", ack: true },
                { id: "u2", ack: false },
                { ack: false },
            ]),
            now
        ),
        { kind: "rosterPublished", unconfirmed: 1 }
    )
})

test("a closed training has no roster step", () => {
    assert.deepEqual(
        matchListPhase({ ...closed, kind: "training" }, undefined, now),
        { kind: "registrationClosed" }
    )
})

test("played events show the result or training outcome", () => {
    const played = event({ status: "concluded" })
    assert.ok(isPlayed(played, now))
    assert.deepEqual(matchListPhase(played, undefined, now), {
        kind: "awaitingResult",
    })
    assert.deepEqual(
        matchListPhase(
            {
                ...played,
                eventResult: {
                    outcome: "defeat",
                    score: { sideA: 1, sideB: 4 },
                },
            },
            undefined,
            now
        ),
        { kind: "result", outcome: "defeat", score: { sideA: 1, sideB: 4 } }
    )
    assert.deepEqual(
        matchListPhase(
            {
                ...played,
                kind: "training",
                participants: [
                    { status: "attending", completed: "passed" },
                    { status: "attending", completed: "passed" },
                    { status: "attending", completed: "failed" },
                ],
            },
            undefined,
            now
        ),
        { kind: "trainingCompleted", passed: 2, failed: 1 }
    )
    assert.deepEqual(
        matchListPhase(
            { ...played, kind: "training", participants: [] },
            undefined,
            now
        ),
        { kind: "concluded" }
    )
})

test("an event past its end counts as played before the bot records it", () => {
    const past = event({
        status: "starting",
        registrationEnd: "2026-09-26T17:30:00.000Z",
        meetingStart: "2026-09-27T17:30:00.000Z",
        gameStart: "2026-09-27T18:00:00.000Z",
        gameEnd: "2026-09-27T19:30:00.000Z",
    })
    assert.ok(isPlayed(past, now))
})

test("the queue lists roster and attendance tasks soonest first", () => {
    const later = {
        ...closed,
        id: "e2",
        gameStart: "2026-10-08T18:00:00.000Z",
        gameEnd: "2026-10-08T19:30:00.000Z",
        meetingStart: "2026-10-08T17:30:00.000Z",
    }
    const queue = matchListQueue(
        [
            later,
            closed,
            event({ id: "e3" }),
            { ...closed, id: "t1", kind: "training" },
        ],
        [
            {
                eventId: "e2",
                published: true,
                squads: [{ players: [{ id: "u1", ack: false }] }],
            },
        ],
        now
    )
    assert.deepEqual(queue, [
        {
            kind: "publishRoster",
            eventId: "e1",
            gameStart: "2026-10-06T18:00:00.000Z",
            signedUp: 2,
            openSlots: undefined,
        },
        {
            kind: "confirmAttendance",
            eventId: "e2",
            gameStart: "2026-10-08T18:00:00.000Z",
            unconfirmed: 1,
        },
    ])
})

test("weeks start on Monday in the clan's time zone", () => {
    assert.equal(
        weekOffset("2026-10-11T18:00:00.000Z", now, "Europe/Prague"),
        0
    )
    assert.equal(
        weekOffset("2026-10-12T08:00:00.000Z", now, "Europe/Prague"),
        1
    )
    assert.equal(
        weekOffset("2026-10-04T18:00:00.000Z", now, "Europe/Prague"),
        -1
    )
    // Sunday 23:30 UTC is already Monday in Prague.
    assert.equal(
        weekOffset("2026-10-11T23:30:00.000Z", now, "Europe/Prague"),
        1
    )
    assert.equal(weekOffset("2026-10-11T23:30:00.000Z", now, "UTC"), 0)
})

test("an unknown time zone falls back to UTC", () => {
    assert.equal(
        localDayNumber("2026-10-05T12:00:00.000Z", "Not/AZone"),
        localDayNumber("2026-10-05T12:00:00.000Z", "UTC")
    )
})

test("items are grouped by consecutive week", () => {
    const groups = groupByWeek(
        [
            "2026-10-06T18:00:00.000Z",
            "2026-10-11T18:00:00.000Z",
            "2026-10-14T18:00:00.000Z",
            "2026-10-28T18:00:00.000Z",
        ],
        (value) => value,
        now,
        "UTC"
    )
    assert.deepEqual(
        groups.map((group) => [
            group.offset,
            group.weekStart,
            group.items.length,
        ]),
        [
            [0, "2026-10-05T00:00:00.000Z", 2],
            [1, "2026-10-12T00:00:00.000Z", 1],
            [3, "2026-10-26T00:00:00.000Z", 1],
        ]
    )
})
