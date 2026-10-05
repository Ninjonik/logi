import assert from "node:assert/strict"
import test from "node:test"

import {
    getGridDayKey,
    getMonthLabel,
    getWeekdayLabels,
    validateCalendarItemInput,
} from "./calendar-display"

test("weekday labels start on Monday and follow the locale", () => {
    assert.deepEqual(getWeekdayLabels("en-GB"), [
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
        "Sun",
    ])
    const czech = getWeekdayLabels("cs-CZ")
    assert.equal(czech.length, 7)
    assert.equal(czech[0], "po")
    assert.equal(czech[6], "ne")
    assert.equal(getWeekdayLabels("de-DE")[0], "Mo")
})

test("month label is localized and independent of the host time zone", () => {
    assert.equal(
        getMonthLabel({ year: 2026, monthIndex: 9 }, "en-GB"),
        "October 2026"
    )
    assert.equal(
        getMonthLabel({ year: 2026, monthIndex: 9 }, "cs-CZ"),
        "říjen 2026"
    )
    assert.equal(
        getMonthLabel({ year: 2026, monthIndex: 0 }, "de-DE"),
        "Januar 2026"
    )
})

test("grid day key uses the calendar date, padded", () => {
    assert.equal(
        getGridDayKey({ year: 2026, monthIndex: 0, date: 5 }),
        "2026-01-05"
    )
    assert.equal(
        getGridDayKey({ year: 2026, monthIndex: 11, date: 31 }),
        "2026-12-31"
    )
})

test("calendar item input requires a title and an ordered range", () => {
    assert.deepEqual(
        validateCalendarItemInput({
            title: "Scrim",
            startAt: "2026-10-05T18:00:00.000Z",
            endAt: "2026-10-05T20:00:00.000Z",
        }),
        {}
    )
    assert.deepEqual(
        validateCalendarItemInput({ title: "  ", startAt: null, endAt: null }),
        {
            title: "title_required",
            startAt: "start_required",
            endAt: "end_required",
        }
    )
    assert.deepEqual(
        validateCalendarItemInput({
            title: "Scrim",
            startAt: "2026-10-05T20:00:00.000Z",
            endAt: "2026-10-05T18:00:00.000Z",
        }),
        { endAt: "end_before_start" }
    )
    assert.deepEqual(
        validateCalendarItemInput({
            title: "Scrim",
            startAt: "not a date",
            endAt: "2026-10-05T18:00:00.000Z",
        }),
        { startAt: "start_required" }
    )
})
