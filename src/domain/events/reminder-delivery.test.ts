import assert from "node:assert/strict"
import test from "node:test"

import {
    joinNames,
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
            audience: "unconfirmed",
            sentAt: "2026-10-11T15:04:30.000Z",
            requestedBy: "kowalski",
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
