import assert from "node:assert/strict"
import test from "node:test"

import { recurringOccurrenceInput, weeklyOccurrenceStarts } from "./recurrence"

const weekly = (weekdays: number[], interval = 1) => ({
    frequency: "weekly" as const,
    interval,
    weekdays,
})

test("a weekly series keeps the local start time across a DST change", () => {
    // Sunday 18 Oct 2026, 20:00 in Prague (summer time, UTC+2).
    const starts = weeklyOccurrenceStarts({
        seriesStart: "2026-10-18T18:00:00.000Z",
        timeZone: "Europe/Prague",
        recurrence: weekly([0]),
        after: "2026-10-18T18:00:00.000Z",
        until: "2026-11-01T23:00:00.000Z",
    })
    // Winter time from 25 Oct: 20:00 is 19:00 UTC.
    assert.deepEqual(starts, [
        "2026-10-25T19:00:00.000Z",
        "2026-11-01T19:00:00.000Z",
    ])
})

test("only chosen weekdays of every n-th week are created", () => {
    // Wednesday 7 Oct 2026, 18:00 UTC.
    const starts = weeklyOccurrenceStarts({
        seriesStart: "2026-10-07T18:00:00.000Z",
        timeZone: "UTC",
        recurrence: weekly([3, 5], 2),
        after: "2026-10-07T18:00:00.000Z",
        until: "2026-10-25T00:00:00.000Z",
    })
    assert.deepEqual(starts, [
        // Friday of the first week, then Wednesday and Friday two weeks later.
        "2026-10-09T18:00:00.000Z",
        "2026-10-21T18:00:00.000Z",
        "2026-10-23T18:00:00.000Z",
    ])
})

test("nothing before the last occurrence or past the horizon is created", () => {
    const starts = weeklyOccurrenceStarts({
        seriesStart: "2026-01-04T19:00:00.000Z",
        timeZone: "UTC",
        recurrence: weekly([0]),
        // An old series only continues from now on.
        after: "2026-10-05T10:00:00.000Z",
        until: "2026-10-19T10:00:00.000Z",
    })
    assert.deepEqual(starts, [
        "2026-10-11T19:00:00.000Z",
        "2026-10-18T19:00:00.000Z",
    ])
})

test("monthly series, bad dates and limits create nothing extra", () => {
    assert.deepEqual(
        weeklyOccurrenceStarts({
            seriesStart: "2026-10-04T19:00:00.000Z",
            timeZone: "UTC",
            recurrence: {
                frequency: "monthly_date",
                interval: 1,
                weekdays: [],
            },
            after: "2026-10-04T19:00:00.000Z",
            until: "2026-12-31T00:00:00.000Z",
        }),
        []
    )
    assert.deepEqual(
        weeklyOccurrenceStarts({
            seriesStart: "not a date",
            timeZone: "UTC",
            recurrence: weekly([0]),
            after: "2026-10-04T19:00:00.000Z",
            until: "2026-12-31T00:00:00.000Z",
        }),
        []
    )
    assert.equal(
        weeklyOccurrenceStarts({
            seriesStart: "2026-10-04T19:00:00.000Z",
            timeZone: "Not/AZone",
            recurrence: weekly([0, 1, 2, 3, 4, 5, 6]),
            after: "2026-10-04T19:00:00.000Z",
            until: "2026-12-31T00:00:00.000Z",
            limit: 3,
        }).length,
        3
    )
})

test("an occurrence moves every deadline with the start and drops the recurrence", () => {
    const input = recurringOccurrenceInput(
        {
            guildId: "guild-1",
            kind: "match",
            name: "Weekly scrim",
            registrationStart: "2026-10-01T18:00:00.000Z",
            registrationEnd: "2026-10-03T17:30:00.000Z",
            meetingStart: "2026-10-04T17:30:00.000Z",
            gameStart: "2026-10-04T18:00:00.000Z",
            gameEnd: "2026-10-04T19:30:00.000Z",
            pingClan: true,
        },
        "2026-10-11T18:00:00.000Z"
    )
    assert.equal(input.registrationStart, "2026-10-08T18:00:00.000Z")
    assert.equal(input.registrationEnd, "2026-10-10T17:30:00.000Z")
    assert.equal(input.meetingStart, "2026-10-11T17:30:00.000Z")
    assert.equal(input.gameEnd, "2026-10-11T19:30:00.000Z")
    assert.equal(input.recurrence, undefined)
    assert.equal(input.name, "Weekly scrim")
})
