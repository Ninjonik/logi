import assert from "node:assert/strict"
import test from "node:test"

import {
    decideManualReminder,
    MANUAL_REMINDER_COOLDOWN_MS,
    remainingManualReminderRecipients,
    resolveManualReminderRecipients,
    type ManualReminderAssignment,
    type ManualReminderEvent,
    type ManualReminderRoster,
} from "./manual-reminders"

const now = new Date("2026-10-10T18:00:00.000Z")

const event: ManualReminderEvent = {
    kind: "match",
    gameId: "hell_let_loose",
    status: "registration",
    registrationEnd: "2026-10-10T19:00:00.000Z",
    meetingStart: "2026-10-11T17:30:00.000Z",
    participants: [
        { userId: "signed", status: "attending" },
        { userId: "declined", status: "not_attending" },
    ],
}

const roster: ManualReminderRoster = {
    published: true,
    squads: [
        {
            players: [
                { id: "signed", ack: true },
                { id: "slot-pending", ack: false },
                {},
            ],
        },
    ],
    reservePlayerIds: ["reserve-pending", "reserve-ack"],
    reserveAttendances: [{ userId: "reserve-ack", ack: true }],
    notAttendingPlayerIds: ["benched"],
}

const assignments: ManualReminderAssignment[] = [
    { userId: "signed", type: "member", status: "active" },
    { userId: "declined", type: "member", status: "active" },
    { userId: "quiet", type: "member", status: "active" },
    { userId: "recruit", type: "member", status: "recruit" },
    { userId: "paused", type: "member", status: "active", paused: true },
    { userId: "applicant", type: "member", status: "pending" },
    {
        userId: "other-game",
        type: "member",
        status: "active",
        gameId: "wardogs",
    },
    { userId: "slot-pending", type: "member", status: "active" },
    { userId: "benched", type: "member", status: "active" },
    { userId: "quiet", type: "member", status: "active" },
]

test("unanswered reminders reach eligible members of the game who have not answered", () => {
    const result = resolveManualReminderRecipients({
        audience: "unanswered",
        event,
        roster,
        assignments,
        now,
    })
    assert.deepEqual(result, { ok: true, userIds: ["quiet", "recruit"] })
})

test("unanswered reminders respect the statuses allowed to sign up", () => {
    const result = resolveManualReminderRecipients({
        audience: "unanswered",
        event: { ...event, allowedSignupStatuses: ["member"] },
        roster: null,
        assignments,
        now,
    })
    assert.deepEqual(result, {
        ok: true,
        userIds: ["quiet", "slot-pending", "benched"],
    })
})

test("unanswered reminders stop once sign-ups are closed, concluded or a draft", () => {
    assert.deepEqual(
        resolveManualReminderRecipients({
            audience: "unanswered",
            event: { ...event, status: "closed" },
            roster,
            assignments,
            now,
        }),
        { ok: false, reason: "signups_closed" }
    )
    assert.deepEqual(
        resolveManualReminderRecipients({
            audience: "unanswered",
            event: { ...event, status: "concluded" },
            roster,
            assignments,
            now,
        }),
        { ok: false, reason: "concluded" }
    )
    assert.deepEqual(
        resolveManualReminderRecipients({
            audience: "unanswered",
            event: { ...event, isDraft: true },
            roster,
            assignments,
            now,
        }),
        { ok: false, reason: "draft" }
    )
})

test("unconfirmed reminders reach roster players and reserves without a confirmation", () => {
    const result = resolveManualReminderRecipients({
        audience: "unconfirmed",
        event: { ...event, status: "starting" },
        roster,
        assignments,
        now,
    })
    assert.deepEqual(result, {
        ok: true,
        userIds: ["slot-pending", "reserve-pending"],
    })
})

test("unconfirmed reminders need a published roster before the meeting", () => {
    assert.deepEqual(
        resolveManualReminderRecipients({
            audience: "unconfirmed",
            event,
            roster: null,
            assignments,
            now,
        }),
        { ok: false, reason: "no_roster" }
    )
    assert.deepEqual(
        resolveManualReminderRecipients({
            audience: "unconfirmed",
            event,
            roster: { ...roster, published: false },
            assignments,
            now,
        }),
        { ok: false, reason: "roster_unpublished" }
    )
    assert.deepEqual(
        resolveManualReminderRecipients({
            audience: "unconfirmed",
            event: { ...event, meetingStart: "2026-10-10T17:59:00.000Z" },
            roster,
            assignments,
            now,
        }),
        { ok: false, reason: "meeting_started" }
    )
})

test("a reminder waiting for the bot answers a repeated request with its count", () => {
    const decision = decideManualReminder({
        audience: "unanswered",
        previous: [
            {
                audience: "unanswered",
                requestedAt: "2026-10-10T17:58:00.000Z",
                status: "pending",
                recipientCount: 7,
            },
        ],
        now,
    })
    assert.deepEqual(decision, { kind: "already_queued", recipientCount: 7 })
})

test("a sent reminder blocks the same audience until the cool-down ends", () => {
    const sentAt = new Date(now.getTime() - 5 * 60 * 1000)
    const previous = [
        {
            audience: "unanswered" as const,
            requestedAt: sentAt.toISOString(),
            status: "sent" as const,
            recipientCount: 4,
        },
    ]
    assert.deepEqual(
        decideManualReminder({ audience: "unanswered", previous, now }),
        {
            kind: "rate_limited",
            retryAt: new Date(
                sentAt.getTime() + MANUAL_REMINDER_COOLDOWN_MS
            ).toISOString(),
        }
    )
    assert.deepEqual(
        decideManualReminder({ audience: "unconfirmed", previous, now }),
        { kind: "queue" }
    )
    assert.deepEqual(
        decideManualReminder({
            audience: "unanswered",
            previous,
            now: new Date(sentAt.getTime() + MANUAL_REMINDER_COOLDOWN_MS),
        }),
        { kind: "queue" }
    )
})

test("failed and abandoned reminders never block a new one", () => {
    const decision = decideManualReminder({
        audience: "unconfirmed",
        previous: [
            {
                audience: "unconfirmed",
                requestedAt: "2026-10-10T17:59:00.000Z",
                status: "failed",
                recipientCount: 3,
            },
            {
                audience: "unconfirmed",
                requestedAt: "2026-10-10T17:30:00.000Z",
                status: "pending",
                recipientCount: 3,
            },
        ],
        now,
    })
    assert.deepEqual(decision, { kind: "queue" })
})

test("the bot skips recipients who answered after the reminder was queued", () => {
    assert.deepEqual(
        remainingManualReminderRecipients({
            requested: ["a", "b", "c"],
            current: { ok: true, userIds: ["c", "a", "z"] },
        }),
        ["a", "c"]
    )
    assert.deepEqual(
        remainingManualReminderRecipients({
            requested: ["a"],
            current: { ok: false, reason: "concluded" },
        }),
        []
    )
})
