import assert from "node:assert/strict"
import test from "node:test"

import {
    currentEventStatus,
    canAcceptSignups,
    deriveEventStatus,
    isEventCancelledBeforeMeeting,
    isTrainingRegistrationStillOpen,
    normalizeEventTimestamps,
    resolveCreateForumChannel,
} from "./status"

test("deriveEventStatus returns registration before registration ends", () => {
    assert.equal(
        deriveEventStatus(
            {
                registrationEnd: "2026-01-01T10:00:00.000Z",
                meetingStart: "2026-01-01T12:00:00.000Z",
                gameEnd: "2026-01-01T14:00:00.000Z",
            },
            new Date("2026-01-01T09:00:00.000Z")
        ),
        "registration"
    )
})

test("deriveEventStatus returns starting in meeting countdown window", () => {
    assert.equal(
        deriveEventStatus(
            {
                registrationEnd: "2026-01-01T10:00:00.000Z",
                meetingStart: "2026-01-01T12:00:00.000Z",
                gameEnd: "2026-01-01T14:00:00.000Z",
            },
            new Date("2026-01-01T11:00:00.000Z")
        ),
        "starting"
    )
})

test("deriveEventStatus restores registration when a starting event is rescheduled before registration closes", () => {
    assert.equal(
        deriveEventStatus(
            {
                registrationEnd: "2026-01-02T10:00:00.000Z",
                meetingStart: "2026-01-03T12:00:00.000Z",
                gameEnd: "2026-01-03T14:00:00.000Z",
                status: "starting",
            },
            new Date("2026-01-01T09:00:00.000Z")
        ),
        "registration"
    )
})

test("training registration can stay open after starting", () => {
    const event = {
        kind: "training" as const,
        registrationEnd: "2026-01-01T12:00:00.000Z",
        status: "starting" as const,
    }

    assert.equal(
        isTrainingRegistrationStillOpen(
            event,
            new Date("2026-01-01T11:30:00.000Z")
        ),
        true
    )
    assert.equal(
        canAcceptSignups(event, new Date("2026-01-01T11:30:00.000Z")),
        true
    )
})

test("deriveEventStatus returns closed after registration ends but before the starting window", () => {
    assert.equal(
        deriveEventStatus(
            {
                registrationEnd: "2026-01-01T10:00:00.000Z",
                meetingStart: "2026-01-03T12:00:00.000Z",
                gameEnd: "2026-01-03T14:00:00.000Z",
            },
            new Date("2026-01-01T10:30:00.000Z")
        ),
        "closed"
    )
})

test("deriveEventStatus concludes after the 15-minute reserve and preserves explicit concluded state", () => {
    assert.equal(
        deriveEventStatus(
            {
                registrationEnd: "2026-01-01T10:00:00.000Z",
                meetingStart: "2026-01-01T12:00:00.000Z",
                gameEnd: "2026-01-01T14:00:00.000Z",
            },
            new Date("2026-01-01T14:15:00.000Z")
        ),
        "concluded"
    )

    assert.equal(
        deriveEventStatus(
            {
                registrationEnd: "2026-01-01T10:00:00.000Z",
                meetingStart: "2026-01-04T12:00:00.000Z",
                gameEnd: "2026-01-04T14:00:00.000Z",
                status: "concluded",
            },
            new Date("2026-01-01T09:00:00.000Z")
        ),
        "concluded"
    )
})

test("resolveCreateForumChannel defaults to matches and honors explicit overrides", () => {
    assert.equal(resolveCreateForumChannel({ kind: "match" }), true)
    assert.equal(resolveCreateForumChannel({ kind: "training" }), false)
    assert.equal(
        resolveCreateForumChannel({
            kind: "training",
            createForumChannel: true,
        }),
        true
    )
})

test("isEventCancelledBeforeMeeting compares concludedAt against meetingStart", () => {
    assert.equal(
        isEventCancelledBeforeMeeting({
            concludedAt: "2026-01-01T10:00:00.000Z",
            meetingStart: "2026-01-01T11:00:00.000Z",
        }),
        true
    )

    assert.equal(
        isEventCancelledBeforeMeeting({
            concludedAt: "2026-01-01T11:30:00.000Z",
            meetingStart: "2026-01-01T11:00:00.000Z",
        }),
        false
    )
})

test("normalizeEventTimestamps falls back to available event timestamps", () => {
    assert.deepEqual(
        normalizeEventTimestamps(
            {
                registrationEnd: "2026-01-01T07:00:00.000Z",
                meetingStart: "2026-01-01T08:00:00.000Z",
                gameEnd: "2026-01-01T09:00:00.000Z",
                createdAt: "2026-01-01T08:00:00.000Z",
                updatedAt: "2026-01-01T09:00:00.000Z",
            },
            "2026-01-01T10:00:00.000Z"
        ),
        {
            statusUpdatedAt: "2026-01-01T09:00:00.000Z",
            updatedAt: "2026-01-01T09:00:00.000Z",
        }
    )
})

test("currentEventStatus advances a stale stored status by the schedule", () => {
    const schedule = {
        registrationEnd: "2026-10-01T17:00:00.000Z",
        meetingStart: "2026-10-01T18:00:00.000Z",
        gameEnd: "2026-10-01T20:00:00.000Z",
    }
    const afterEnd = new Date("2026-10-01T20:15:00.000Z")
    assert.equal(
        currentEventStatus({ ...schedule, status: "starting" }, afterEnd),
        "concluded"
    )
    assert.equal(
        currentEventStatus(
            { ...schedule, status: "starting" },
            new Date("2026-10-01T20:14:59.000Z")
        ),
        "starting"
    )
    // Without a complete schedule the stored status stands.
    assert.equal(
        currentEventStatus({ status: "starting" }, afterEnd),
        "starting"
    )
    assert.equal(currentEventStatus({}, afterEnd), undefined)
})

test("signups wait for registrationStart, open at the exact instant and retain immediate legacy opening", () => {
    const event = {
        status: "registration" as const,
        kind: "match" as const,
        registrationStart: "2027-01-13T19:00:00Z",
        registrationEnd: "2027-01-19T18:30:00Z",
        meetingStart: "2027-01-20T18:30:00Z",
        allowLateSignups: true,
    }
    assert.equal(
        canAcceptSignups(event, new Date("2027-01-13T18:59:59Z")),
        false
    )
    assert.equal(
        canAcceptSignups(event, new Date(event.registrationStart)),
        true
    )
    assert.equal(
        canAcceptSignups(
            { ...event, registrationStart: undefined },
            new Date("2027-01-01")
        ),
        true
    )
    assert.equal(
        canAcceptSignups(
            { ...event, registrationStart: "invalid" },
            new Date("2027-01-01")
        ),
        false
    )
})
