import assert from "node:assert/strict"
import test from "node:test"

import {
    calendarDayDistance,
    calendarDayKeys,
    eventsByDay,
    monthAttendanceLeaders,
    nextUpcomingMatch,
    pendingApplications,
    recentForm,
    resultsAwaitingConfirmation,
    rosterFill,
    signupSummary,
    upcomingEvents,
    type OverviewAssignment,
    type OverviewEvent,
    type ScoredEvent,
} from "./clan-overview"

const now = new Date("2026-10-11T12:00:00.000Z")

function event(overrides: Partial<OverviewEvent> = {}): OverviewEvent {
    return {
        id: "event-1",
        name: "Friendly",
        kind: "match",
        status: "registration",
        registrationEnd: "2026-10-11T17:00:00.000Z",
        meetingStart: "2026-10-11T17:30:00.000Z",
        gameStart: "2026-10-11T18:00:00.000Z",
        gameEnd: "2026-10-11T20:00:00.000Z",
        participants: [],
        ...overrides,
    }
}

function assignment(
    overrides: Partial<OverviewAssignment> = {}
): OverviewAssignment {
    return {
        userId: "user-1",
        type: "member",
        status: "active",
        paused: false,
        createdAt: "2026-10-01T10:00:00.000Z",
        ...overrides,
    }
}

function reviewed(status: "provisional" | "confirmed", scores = [3, 2]) {
    return {
        reviewedResultGameId: "hell_let_loose",
        reviewedResult: {
            version: 1,
            status,
            participants: scores.map((score, index) => ({
                id: `side-${index}`,
                label: `Side ${index}`,
                score,
            })),
            provenance: { origin: "legacy_import", sources: [] },
            reviewedAt: null,
            supersedesVersion: null,
            attribution: { verified: 0, unresolved: 0 },
        },
    }
}

test("the next match is the earliest one not concluded", () => {
    const later = event({
        id: "later",
        gameStart: "2026-10-14T18:00:00.000Z",
        gameEnd: "2026-10-14T20:00:00.000Z",
    })
    const sooner = event({ id: "sooner" })
    const training = event({
        id: "training",
        kind: "training",
        gameStart: "2026-10-11T13:00:00.000Z",
    })
    const past = event({
        id: "past",
        gameStart: "2026-10-10T18:00:00.000Z",
        gameEnd: "2026-10-10T20:00:00.000Z",
    })
    const cancelled = event({ id: "cancelled", status: "concluded" })
    assert.equal(
        nextUpcomingMatch([later, training, past, cancelled, sooner], now)?.id,
        "sooner"
    )
    assert.equal(nextUpcomingMatch([past, training], now), null)
})

test("upcoming events include trainings and leave out concluded ones", () => {
    const upcoming = upcomingEvents(
        [
            event({ id: "later", gameStart: "2026-10-14T18:00:00.000Z" }),
            event({
                id: "training",
                kind: "training",
                gameStart: "2026-10-12T18:00:00.000Z",
            }),
            event({ id: "done", status: "concluded" }),
            event({ id: "broken", gameStart: "not-a-date" }),
        ],
        now
    )
    assert.deepEqual(
        upcoming.map((item) => item.id),
        ["training", "later"]
    )
})

test("a match in progress still counts as the next match", () => {
    const running = event({
        gameStart: "2026-10-11T11:00:00.000Z",
        gameEnd: "2026-10-11T13:00:00.000Z",
    })
    assert.equal(nextUpcomingMatch([running], now)?.id, "event-1")
})

test("roster fill counts named and custom players", () => {
    assert.deepEqual(
        rosterFill({
            eventId: "event-1",
            published: false,
            squads: [
                { players: [{ id: "a" }, {}, { customName: " Guest " }] },
                { players: [{ customName: "  " }] },
            ],
        }),
        { filled: 2, total: 4 }
    )
    assert.equal(rosterFill(null), null)
    assert.equal(
        rosterFill({ eventId: "event-1", published: true, squads: [] }),
        null
    )
})

test("sign-ups count attending players and members who have not answered", () => {
    const match = event({
        participants: [
            { userId: "yes", status: "attending" },
            { userId: "no", status: "not_attending" },
        ],
    })
    const summary = signupSummary(match, [
        assignment({ userId: "yes" }),
        assignment({ userId: "no" }),
        assignment({ userId: "waiting" }),
        assignment({ userId: "recruit", status: "recruit" }),
        assignment({ userId: "applicant", status: "pending" }),
        assignment({ userId: "paused", paused: true }),
        assignment({ userId: "other-game", gameId: "wardogs" }),
        assignment({ userId: "waiting", gameId: "hell_let_loose" }),
    ])
    assert.deepEqual(summary, { signedUp: 1, unanswered: 2 })
})

test("unanswered respects the match's allowed membership", () => {
    const match = event({ allowedSignupStatuses: ["member"] })
    assert.equal(
        signupSummary(match, [
            assignment({ userId: "member" }),
            assignment({ userId: "mercenary", type: "mercenary" }),
            assignment({ userId: "recruit", status: "recruit" }),
        ]).unanswered,
        1
    )
})

test("unanswered is unknown when the match requires Discord roles", () => {
    assert.deepEqual(
        signupSummary(event({ requiredRoleIds: ["role"] }), [assignment()]),
        { signedUp: 0, unanswered: null }
    )
})

test("form lists the last outcomes oldest first and marks unconfirmed ones", () => {
    const matches = Array.from({ length: 12 }, (_, index) =>
        event({
            id: `m${index}`,
            gameEnd: `2026-09-${String(index + 10).padStart(2, "0")}T20:00:00.000Z`,
            eventResult: {
                outcome: index % 3 === 0 ? "defeat" : "victory",
            },
        })
    )
    matches[11] = { ...matches[11], ...reviewed("provisional") }
    const form = recentForm([
        ...matches,
        event({ id: "no-result" }),
        event({
            id: "training",
            kind: "training",
            eventResult: { outcome: "victory" },
        }),
    ])
    assert.deepEqual(
        form.matches.map((match) => match.eventId),
        ["m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10", "m11"]
    )
    assert.equal(form.wins, 7)
    assert.equal(form.matches.at(-1)?.pending, true)
    assert.equal(form.matches[0].pending, false)
})

test("results awaiting confirmation need a valid provisional head for the event's game", () => {
    const pending = event({ id: "pending", ...reviewed("provisional") })
    const confirmed = event({ id: "confirmed", ...reviewed("confirmed") })
    const otherGame = event({
        id: "other-game",
        ...reviewed("provisional"),
        reviewedResultGameId: "wardogs",
    })
    const broken = event({
        id: "broken",
        reviewedResultGameId: "hell_let_loose",
        reviewedResult: { status: "provisional" },
    })
    const threeWay = event({
        id: "three-way",
        gameEnd: "2026-10-01T20:00:00.000Z",
        ...reviewed("provisional", [1, 2, 3]),
    })
    assert.deepEqual(
        resultsAwaitingConfirmation([
            threeWay,
            confirmed,
            otherGame,
            broken,
            pending,
        ]),
        [
            {
                eventId: "pending",
                name: "Friendly",
                gameEnd: "2026-10-11T20:00:00.000Z",
                score: { sideA: 3, sideB: 2 },
            },
            {
                eventId: "three-way",
                name: "Friendly",
                gameEnd: "2026-10-01T20:00:00.000Z",
                score: null,
            },
        ]
    )
})

test("pending applications report their count and the oldest date", () => {
    assert.deepEqual(
        pendingApplications([
            assignment({
                status: "pending",
                createdAt: "2026-10-08T10:00:00Z",
            }),
            assignment({
                status: "pending",
                createdAt: "2026-10-06T10:00:00Z",
            }),
            assignment({ status: "active", createdAt: "2026-01-01T10:00:00Z" }),
        ]),
        { count: 2, oldestAt: "2026-10-06T10:00:00Z" }
    )
    assert.deepEqual(pendingApplications([]), { count: 0, oldestAt: null })
})

test("calendar days step by date across month ends and clock changes", () => {
    assert.deepEqual(calendarDayKeys("2026-10-29", 4), [
        "2026-10-29",
        "2026-10-30",
        "2026-10-31",
        "2026-11-01",
    ])
    assert.deepEqual(calendarDayKeys("not-a-date"), [])
    assert.equal(calendarDayDistance("2026-10-31", "2026-11-01"), 1)
    assert.equal(calendarDayDistance("2026-10-11", "2026-10-11"), 0)
    assert.ok(Number.isNaN(calendarDayDistance("x", "2026-10-11")))
})

test("events are grouped under their start day and sorted", () => {
    const keys = calendarDayKeys("2026-10-11", 2)
    const dayKeyOf = (iso: string) => iso.slice(0, 10)
    const grouped = eventsByDay(
        [
            event({ id: "late", gameStart: "2026-10-11T19:00:00Z" }),
            event({ id: "early", gameStart: "2026-10-11T08:00:00Z" }),
            event({ id: "outside", gameStart: "2026-10-20T08:00:00Z" }),
        ],
        keys,
        dayKeyOf
    )
    assert.deepEqual(
        grouped.map((day) => [day.key, day.events.map((item) => item.id)]),
        [
            ["2026-10-11", ["early", "late"]],
            ["2026-10-12", []],
        ]
    )
})

const scoreRules = {
    noCategory: 0,
    declined: -1,
    rosterPresent: 3,
    reservePresent: 2,
    rosterAbsent: -2,
    reserveAbsent: 0,
    excusedAbsence: 1,
}

function scoredEvent(
    overrides: Partial<ScoredEvent> & { id: string }
): ScoredEvent {
    return {
        gameStart: "2026-10-04T18:00:00.000Z",
        status: "concluded",
        scoreResolution: "applied",
        participants: [],
        absenceNotices: [],
        ...overrides,
    }
}

function scoredRoster(
    eventId: string,
    players: Array<{ id: string; confirmed?: boolean }>,
    reserves: Array<{ userId: string; confirmed?: boolean }> = []
) {
    return {
        eventId,
        squads: [{ players }],
        reservePlayerIds: reserves.map((reserve) => reserve.userId),
        reserveAttendances: reserves,
    }
}

const monthKeyOf = (iso: string) => iso.slice(0, 7)

test("month attendance points apply the clan's rules to applied matches of the month", () => {
    const attending = (userId: string) => ({
        userId,
        status: "attending" as const,
    })
    const result = monthAttendanceLeaders({
        events: [
            scoredEvent({
                id: "a",
                participants: [
                    attending("u1"),
                    attending("u2"),
                    attending("u3"),
                    { userId: "u4", status: "not_attending" },
                ],
                absenceNotices: [{ userId: "u3" }],
            }),
            scoredEvent({
                id: "b",
                gameStart: "2026-10-18T18:00:00.000Z",
                participants: [attending("u1"), attending("u2")],
            }),
            // Not counted: other month, skipped, not concluded.
            scoredEvent({
                id: "september",
                gameStart: "2026-09-30T18:00:00.000Z",
                participants: [attending("u2")],
            }),
            scoredEvent({
                id: "skipped",
                scoreResolution: "skipped",
                participants: [attending("u2")],
            }),
            scoredEvent({
                id: "open",
                status: "starting",
                scoreResolution: undefined,
                participants: [attending("u2")],
            }),
        ],
        rosters: [
            scoredRoster("a", [
                { id: "u1", confirmed: true },
                { id: "u2", confirmed: true },
                { id: "u3" },
            ]),
            scoredRoster(
                "b",
                [{ id: "u1", confirmed: true }],
                [{ userId: "u2", confirmed: true }]
            ),
            scoredRoster("september", [{ id: "u2", confirmed: true }]),
            scoredRoster("skipped", [{ id: "u2", confirmed: true }]),
            scoredRoster("open", [{ id: "u2", confirmed: true }]),
        ],
        assignments: [
            { userId: "u1", paused: false },
            // A second game's assignment does not count the member twice.
            { userId: "u1", paused: false },
            { userId: "u2", paused: false },
            { userId: "u3", paused: false },
            { userId: "u4", paused: false },
            { userId: "u5", paused: true },
        ],
        settings: scoreRules,
        monthKey: "2026-10",
        monthKeyOf,
    })

    assert.equal(result.events, 2)
    // u1: 3 + 3, u2: 3 + 2, u3: excused 1, u4: declined -1 (not listed).
    assert.deepEqual(result.leaders, [
        { userId: "u1", points: 6 },
        { userId: "u2", points: 5 },
        { userId: "u3", points: 1 },
    ])
})

test("month attendance points rank ties by user ID and respect the limit", () => {
    const events = ["x", "y"].map((id) =>
        scoredEvent({
            id,
            participants: ["u3", "u1", "u2"].map((userId) => ({
                userId,
                status: "attending" as const,
            })),
        })
    )
    const result = monthAttendanceLeaders({
        events,
        rosters: events.map((item) =>
            scoredRoster(item.id, [
                { id: "u1", confirmed: true },
                { id: "u2", confirmed: true },
                { id: "u3", confirmed: true },
            ])
        ),
        assignments: ["u3", "u2", "u1"].map((userId) => ({
            userId,
            paused: false,
        })),
        settings: scoreRules,
        monthKey: "2026-10",
        monthKeyOf,
        limit: 2,
    })
    assert.deepEqual(result.leaders, [
        { userId: "u1", points: 6 },
        { userId: "u2", points: 6 },
    ])
})

test("month attendance points are empty with the default rules or no matches", () => {
    const result = monthAttendanceLeaders({
        events: [
            scoredEvent({
                id: "a",
                participants: [{ userId: "u1", status: "not_attending" }],
            }),
        ],
        rosters: [],
        assignments: [{ userId: "u1", paused: false }],
        settings: { ...scoreRules, rosterPresent: 0, excusedAbsence: 0 },
        monthKey: "2026-10",
        monthKeyOf,
    })
    assert.deepEqual(result, { leaders: [], events: 1 })
    assert.deepEqual(
        monthAttendanceLeaders({
            events: [],
            rosters: [],
            assignments: [],
            settings: scoreRules,
            monthKey: "2026-10",
            monthKeyOf,
        }),
        { leaders: [], events: 0 }
    )
})
