import assert from "node:assert/strict"
import test from "node:test"

import {
    groupByWeek,
    isPlayed,
    localDayNumber,
    matchListPhase,
    matchListQueue,
    toMatchListResultReview,
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
        { kind: "result", outcome: "defeat", scores: [1, 4], review: null }
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

test("a draft has no other phase and is never played", () => {
    const past = event({
        isDraft: true,
        status: "concluded",
        registrationEnd: "2026-09-26T17:30:00.000Z",
        meetingStart: "2026-09-27T17:30:00.000Z",
        gameStart: "2026-09-27T18:00:00.000Z",
        gameEnd: "2026-09-27T19:30:00.000Z",
    })
    assert.deepEqual(matchListPhase(past, undefined, now), { kind: "draft" })
    assert.equal(isPlayed(past, now), false)
    assert.deepEqual(matchListPhase(event({ isDraft: true }), undefined, now), {
        kind: "draft",
    })
})

test("a result head keeps scores only when every participant has one", () => {
    assert.deepEqual(
        toMatchListResultReview({
            status: "provisional",
            origin: "legacy_import",
            participants: [{ score: 3 }, { score: 2 }],
        }),
        { status: "provisional", origin: "legacy_import", scores: [3, 2] }
    )
    assert.deepEqual(
        toMatchListResultReview({
            status: "confirmed",
            origin: "collected",
            participants: [{ score: 3 }, { score: null }],
        }).scores,
        null
    )
    assert.deepEqual(
        toMatchListResultReview({
            status: "confirmed",
            origin: "manual",
            participants: [{ score: 3 }, { score: 2 }, { score: 0 }],
        }).scores,
        [3, 2, 0]
    )
})

test("a reviewed result decides between waiting and confirmed", () => {
    const played = event({
        status: "concluded",
        eventResult: { outcome: "victory", score: { sideA: 3, sideB: 2 } },
    })
    assert.deepEqual(
        matchListPhase(played, undefined, now, {
            status: "provisional",
            origin: "legacy_import",
            scores: [3, 2],
        }),
        { kind: "resultPending", scores: [3, 2] }
    )
    // A staged result without usable scores falls back to the import.
    assert.deepEqual(
        matchListPhase(played, undefined, now, {
            status: "provisional",
            origin: "collected",
            scores: null,
        }),
        { kind: "resultPending", scores: [3, 2] }
    )
    assert.deepEqual(
        matchListPhase(played, undefined, now, {
            status: "confirmed",
            origin: "legacy_import",
            scores: [3, 2],
        }),
        {
            kind: "result",
            outcome: "victory",
            scores: [3, 2],
            review: "confirmed",
        }
    )
    // A correction to other numbers no longer matches the imported outcome.
    assert.deepEqual(
        matchListPhase(played, undefined, now, {
            status: "corrected",
            origin: "manual",
            scores: [1, 2],
        }),
        { kind: "result", outcome: null, scores: [1, 2], review: "corrected" }
    )
    // A collected result without an import has no outcome to show.
    assert.deepEqual(
        matchListPhase(event({ status: "concluded" }), undefined, now, {
            status: "confirmed",
            origin: "collected",
            scores: [5, 0],
        }),
        { kind: "result", outcome: null, scores: [5, 0], review: "confirmed" }
    )
    // A review of an upcoming match does not change its phase.
    assert.deepEqual(
        matchListPhase(event(), undefined, now, {
            status: "provisional",
            origin: "manual",
            scores: [1, 0],
        }).kind,
        "registration"
    )
})

test("the queue lists rosters to publish soonest first", () => {
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
            // A published roster before the match is not a task; its row
            // shows who has not confirmed.
            { ...closed, id: "e4" },
        ],
        [
            {
                eventId: "e2",
                published: false,
                squads: [
                    { players: [{ id: "u1", ack: false }, { ack: false }] },
                ],
            },
            {
                eventId: "e4",
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
            kind: "publishRoster",
            eventId: "e2",
            gameStart: "2026-10-08T18:00:00.000Z",
            signedUp: 2,
            openSlots: 1,
        },
    ])
})

test("played matches with an open attendance ask for a check for two weeks", () => {
    const played = (id: string, day: string) =>
        event({
            id,
            status: "concluded",
            registrationEnd: `2026-${day}T16:00:00.000Z`,
            meetingStart: `2026-${day}T17:30:00.000Z`,
            gameStart: `2026-${day}T18:00:00.000Z`,
            gameEnd: `2026-${day}T19:30:00.000Z`,
        })
    const published = (eventId: string): MatchListRoster => ({
        eventId,
        published: true,
        squads: [
            {
                players: [
                    { id: "u1", ack: true },
                    { id: "u2", ack: false },
                    { id: "u3", ack: false },
                ],
            },
        ],
    })
    const queue = matchListQueue(
        [
            played("recent", "10-04"),
            played("open", "10-03"),
            {
                ...played("applied", "10-02"),
                scoreAppliedAt: "2026-10-03T08:00:00.000Z",
            },
            { ...played("skipped", "10-02"), scoreResolution: "skipped" },
            played("old", "09-20"),
            played("unpublished", "10-01"),
            played("noRoster", "09-30"),
        ],
        [
            published("recent"),
            published("open"),
            published("applied"),
            published("skipped"),
            published("old"),
            { ...published("unpublished"), published: false },
        ],
        now
    ).filter((item) => item.kind === "confirmAttendance")
    assert.deepEqual(
        queue.map((item) => item.eventId),
        ["recent", "open"]
    )
    assert.deepEqual(queue[0], {
        kind: "confirmAttendance",
        eventId: "recent",
        gameStart: "2026-10-04T18:00:00.000Z",
        unconfirmed: 2,
    })
})

test("the queue adds results to confirm, newest first, and skips drafts", () => {
    const played = (id: string, day: string) =>
        event({
            id,
            status: "concluded",
            registrationEnd: `2026-${day}T16:00:00.000Z`,
            meetingStart: `2026-${day}T17:30:00.000Z`,
            gameStart: `2026-${day}T18:00:00.000Z`,
            gameEnd: `2026-${day}T19:30:00.000Z`,
        })
    const reviews = new Map([
        [
            "old",
            {
                status: "provisional" as const,
                origin: "legacy_import" as const,
                scores: [3, 2],
            },
        ],
        [
            "new",
            {
                status: "provisional" as const,
                origin: "collected" as const,
                scores: null,
            },
        ],
        [
            "done",
            {
                status: "confirmed" as const,
                origin: "manual" as const,
                scores: [1, 0],
            },
        ],
        [
            "draft",
            {
                status: "provisional" as const,
                origin: "manual" as const,
                scores: [1, 0],
            },
        ],
    ])
    const queue = matchListQueue(
        [
            played("old", "09-27"),
            played("new", "10-04"),
            played("done", "10-01"),
            { ...played("draft", "10-03"), isDraft: true },
            { ...closed, id: "draft-roster", isDraft: true },
            closed,
        ],
        [],
        now,
        reviews
    )
    assert.deepEqual(
        queue.map((item) => [item.kind, item.eventId]),
        [
            ["publishRoster", "e1"],
            ["confirmResult", "new"],
            ["confirmResult", "old"],
        ]
    )
    assert.deepEqual(queue[2], {
        kind: "confirmResult",
        eventId: "old",
        gameStart: "2026-09-27T18:00:00.000Z",
        origin: "legacy_import",
        scores: [3, 2],
    })
})

test("one kind of task cannot hide the others", () => {
    const rosterTasks = Array.from({ length: 5 }, (_, index) => ({
        ...closed,
        id: `r${index}`,
    }))
    const attendance = event({
        id: "a1",
        status: "concluded",
        registrationEnd: "2026-10-03T16:00:00.000Z",
        meetingStart: "2026-10-04T17:30:00.000Z",
        gameStart: "2026-10-04T18:00:00.000Z",
        gameEnd: "2026-10-04T19:30:00.000Z",
    })
    const queue = matchListQueue(
        [...rosterTasks, attendance],
        [
            {
                eventId: "a1",
                published: true,
                squads: [{ players: [{ id: "u1", ack: false }] }],
            },
        ],
        now,
        undefined,
        { perKind: 3, limit: 6 }
    )
    assert.deepEqual(
        queue.map((item) => item.eventId),
        ["r0", "r1", "r2", "a1"]
    )
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
