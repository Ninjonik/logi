import assert from "node:assert/strict"
import test from "node:test"

import {
    automaticReminderOutcome,
    joinNames,
    mergeAutomaticReminderRun,
    newestReminderOutcome,
    reminderDeliveryNotice,
    type ManualReminderOutcome,
} from "./reminder-delivery"

const outcome: ManualReminderOutcome = {
    audience: "unconfirmed",
    status: "sent",
    requestedAt: "2026-10-11T15:04:30.000Z",
    completedAt: "2026-10-11T15:05:00.000Z",
    requestedBy: "kowalski",
    recipientCount: 12,
    sentCount: 9,
    failedUserIds: ["mrak", "jezek", "liska"],
}

test("a reminder that missed players names them with the counts", () => {
    assert.deepEqual(reminderDeliveryNotice(outcome), {
        kind: "partial",
        automatic: false,
        audience: "unconfirmed",
        sent: 9,
        total: 12,
        failedUserIds: ["mrak", "jezek", "liska"],
        sentAt: "2026-10-11T15:05:00.000Z",
        requestedBy: "kowalski",
    })
})

test("a reminder that reached everyone needs no notice", () => {
    assert.equal(
        reminderDeliveryNotice({
            ...outcome,
            sentCount: 12,
            failedUserIds: [],
        }),
        null
    )
    assert.equal(reminderDeliveryNotice(null), null)
})

test("a failed send says so without naming players", () => {
    assert.deepEqual(
        reminderDeliveryNotice({
            ...outcome,
            status: "failed",
            completedAt: null,
            sentCount: 0,
        }),
        {
            kind: "failed",
            automatic: false,
            audience: "unconfirmed",
            sentAt: "2026-10-11T15:04:30.000Z",
            requestedBy: "kowalski",
        }
    )
})

test("a scheduled reminder that missed players is a notice without a sender (L2-64)", () => {
    assert.deepEqual(
        reminderDeliveryNotice({
            automatic: true,
            audience: "unanswered",
            status: "sent",
            requestedAt: "2026-10-09T08:00:00.000Z",
            completedAt: "2026-10-09T08:00:00.000Z",
            requestedBy: null,
            recipientCount: 20,
            sentCount: 18,
            failedUserIds: ["mrak", "jezek", "mrak"],
        }),
        {
            kind: "partial",
            automatic: true,
            audience: "unanswered",
            sent: 18,
            total: 20,
            failedUserIds: ["mrak", "jezek"],
            sentAt: "2026-10-09T08:00:00.000Z",
            requestedBy: null,
        }
    )
})

test("duplicate or inconsistent counts never show more than were asked", () => {
    const notice = reminderDeliveryNotice({
        ...outcome,
        recipientCount: 2,
        sentCount: 5,
        failedUserIds: ["mrak", "mrak", "jezek", "liska"],
    })
    assert.equal(notice?.kind, "partial")
    if (notice?.kind !== "partial") return
    assert.deepEqual(notice.failedUserIds, ["mrak", "jezek", "liska"])
    assert.equal(notice.total, 3)
    assert.equal(notice.sent, 0)
})

test("names join with the language's and", () => {
    assert.equal(
        joinNames(["Mrak", "Ježek", "Liška"], "a"),
        "Mrak, Ježek a Liška"
    )
    assert.equal(joinNames(["Mrak", "Ježek"], "and"), "Mrak and Ježek")
    assert.equal(joinNames(["Mrak"], "a"), "Mrak")
    assert.equal(joinNames([], "a"), "")
})

test("passes of one scheduled run merge: a player reached later is no longer missed (L2-64)", () => {
    const first = mergeAutomaticReminderRun(null, {
        sentUserIds: ["a"],
        failedUserIds: ["b", "c"],
    })
    assert.deepEqual(first, {
        recipientIds: ["a", "b", "c"],
        failedUserIds: ["b", "c"],
    })
    assert.deepEqual(
        mergeAutomaticReminderRun(first, {
            sentUserIds: ["b"],
            failedUserIds: ["c", "d"],
        }),
        { recipientIds: ["a", "b", "c", "d"], failedUserIds: ["c", "d"] }
    )
    assert.deepEqual(
        mergeAutomaticReminderRun(
            null,
            { sentUserIds: ["a", "b"], failedUserIds: ["c", "d"] },
            2
        ),
        { recipientIds: ["a", "b"], failedUserIds: ["c", "d"] }
    )
    assert.deepEqual(
        automaticReminderOutcome({
            kind: "attendance",
            sentAt: "2026-10-11T11:30:00.000Z",
            recipientIds: ["a", "b", "c"],
            failedUserIds: ["c"],
        }),
        {
            automatic: true,
            audience: "unconfirmed",
            status: "sent",
            requestedAt: "2026-10-11T11:30:00.000Z",
            completedAt: "2026-10-11T11:30:00.000Z",
            requestedBy: null,
            recipientCount: 3,
            sentCount: 2,
            failedUserIds: ["c"],
        }
    )
})

test("the match page shows the newest manual or scheduled reminder in the window", () => {
    const now = Date.parse("2026-10-11T16:00:00.000Z")
    const week = 7 * 24 * 60 * 60 * 1000
    const scheduled = automaticReminderOutcome({
        kind: "attendance",
        sentAt: "2026-10-11T15:30:00.000Z",
        recipientIds: ["a"],
        failedUserIds: ["a"],
    })
    // The manual reminder came before the scheduled one.
    assert.equal(
        newestReminderOutcome([outcome, scheduled], now, week),
        scheduled
    )
    const later = { ...outcome, completedAt: "2026-10-11T15:45:00.000Z" }
    assert.equal(newestReminderOutcome([later, scheduled], now, week), later)
    assert.equal(newestReminderOutcome([null, null], now, week), null)
    assert.equal(
        newestReminderOutcome([scheduled], now + week, week),
        null,
        "older than a week"
    )
})
