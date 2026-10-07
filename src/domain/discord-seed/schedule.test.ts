import assert from "node:assert/strict"
import test from "node:test"

import {
    autoWindowAt,
    dueScheduleOccurrence,
    nextScheduleOccurrence,
    weekdayRanges,
} from "./schedule"

const PRAGUE = "Europe/Prague"
const at = (iso: string) => Date.parse(iso)
const weekdays = {
    enabled: true,
    slots: [{ days: [1, 2, 3, 4, 5], time: "17:00" }],
}

test("a weekday slot is due from its local time for the grace window", () => {
    // Monday 2026-10-05, 17:03 in Prague (CEST).
    assert.deepEqual(
        dueScheduleOccurrence(weekdays, at("2026-10-05T15:03:00Z"), PRAGUE),
        {
            key: "2026-10-05T17:00",
            at: at("2026-10-05T15:00:00Z"),
            days: [1, 2, 3, 4, 5],
            time: "17:00",
        }
    )
    assert.equal(
        dueScheduleOccurrence(weekdays, at("2026-10-05T15:00:00Z"), PRAGUE)
            ?.key,
        "2026-10-05T17:00",
        "due exactly at the slot time"
    )
    assert.equal(
        dueScheduleOccurrence(weekdays, at("2026-10-05T15:09:59Z"), PRAGUE)
            ?.key,
        "2026-10-05T17:00"
    )
})

test("a slot is not due before its time, after the grace window, on other days or when off", () => {
    for (const iso of [
        "2026-10-05T14:59:59Z",
        "2026-10-05T15:10:00Z",
        "2026-10-10T15:02:00Z",
    ])
        assert.equal(
            dueScheduleOccurrence(weekdays, at(iso), PRAGUE),
            null,
            iso
        )
    assert.equal(
        dueScheduleOccurrence(
            { ...weekdays, enabled: false },
            at("2026-10-05T15:03:00Z"),
            PRAGUE
        ),
        null
    )
})

test("of several due slots the latest wins, and a late-evening slot stays due past midnight", () => {
    const saturday = {
        enabled: true,
        slots: [
            { days: [6], time: "16:55" },
            { days: [6], time: "17:00" },
        ],
    }
    assert.equal(
        dueScheduleOccurrence(saturday, at("2026-10-10T15:02:00Z"), PRAGUE)
            ?.time,
        "17:00"
    )
    const lateMonday = { enabled: true, slots: [{ days: [1], time: "23:55" }] }
    assert.equal(
        dueScheduleOccurrence(lateMonday, at("2026-10-05T22:03:00Z"), PRAGUE)
            ?.key,
        "2026-10-05T23:55",
        "Tuesday 00:03 local still belongs to Monday's slot"
    )
})

test("the next scheduled seed is the first occurrence strictly after now", () => {
    assert.equal(
        nextScheduleOccurrence(weekdays, at("2026-10-05T14:00:00Z"), PRAGUE)
            ?.key,
        "2026-10-05T17:00"
    )
    assert.equal(
        nextScheduleOccurrence(weekdays, at("2026-10-05T15:00:00Z"), PRAGUE)
            ?.key,
        "2026-10-06T17:00"
    )
    assert.equal(
        nextScheduleOccurrence(weekdays, at("2026-10-09T16:00:00Z"), PRAGUE)
            ?.key,
        "2026-10-12T17:00",
        "Friday evening rolls over to Monday"
    )
    assert.equal(
        nextScheduleOccurrence(
            { enabled: true, slots: [] },
            at("2026-10-05T14:00:00Z"),
            PRAGUE
        ),
        null
    )
    assert.equal(
        nextScheduleOccurrence(
            { ...weekdays, enabled: false },
            at("2026-10-05T14:00:00Z"),
            PRAGUE
        ),
        null
    )
})

test("the next occurrence keeps the local time across the autumn DST change", () => {
    const next = nextScheduleOccurrence(
        weekdays,
        at("2026-10-24T10:00:00Z"),
        PRAGUE
    )
    assert.equal(next?.key, "2026-10-26T17:00")
    assert.equal(next?.at, at("2026-10-26T16:00:00Z"))
})

test("the automatic window opens at its start and closes at its end", () => {
    const window = { from: "15:00", to: "22:00" }
    assert.deepEqual(autoWindowAt(window, at("2026-10-05T12:59:00Z"), PRAGUE), {
        open: false,
        openedAt: null,
    })
    assert.deepEqual(autoWindowAt(window, at("2026-10-05T13:00:00Z"), PRAGUE), {
        open: true,
        openedAt: at("2026-10-05T13:00:00Z"),
    })
    assert.equal(
        autoWindowAt(window, at("2026-10-05T19:59:00Z"), PRAGUE).open,
        true
    )
    assert.equal(
        autoWindowAt(window, at("2026-10-05T20:00:00Z"), PRAGUE).open,
        false
    )
})

test("an overnight automatic window spans midnight and an empty window never opens", () => {
    const overnight = { from: "22:00", to: "02:00" }
    assert.deepEqual(
        autoWindowAt(overnight, at("2026-10-05T21:00:00Z"), PRAGUE),
        { open: true, openedAt: at("2026-10-05T20:00:00Z") }
    )
    assert.deepEqual(
        autoWindowAt(overnight, at("2026-10-05T23:00:00Z"), PRAGUE),
        { open: true, openedAt: at("2026-10-05T20:00:00Z") },
        "01:00 local belongs to the window opened the evening before"
    )
    assert.equal(
        autoWindowAt(overnight, at("2026-10-06T01:00:00Z"), PRAGUE).open,
        false
    )
    assert.equal(
        autoWindowAt(
            { from: "15:00", to: "15:00" },
            at("2026-10-05T13:30:00Z"),
            PRAGUE
        ).open,
        false
    )
})

test("weekday ranges group consecutive days Monday first for labels like Po–Pá", () => {
    assert.deepEqual(weekdayRanges([5, 1, 2, 3, 4]), [{ from: 1, to: 5 }])
    assert.deepEqual(weekdayRanges([5, 6]), [{ from: 5, to: 6 }])
    assert.deepEqual(weekdayRanges([6, 0]), [{ from: 6, to: 0 }])
    assert.deepEqual(weekdayRanges([1, 3, 5]), [
        { from: 1, to: 1 },
        { from: 3, to: 3 },
        { from: 5, to: 5 },
    ])
    assert.deepEqual(weekdayRanges([]), [])
})
