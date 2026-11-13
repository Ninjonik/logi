import { expandCalendarItems } from "./calendar-items"
import type { CalendarItem } from "@/types/domain"
import assert from "node:assert/strict"
import test from "node:test"

function item(
    startAt: string,
    frequency: "weekly" | "monthly_date" | "monthly_nth_weekday" | "yearly",
    patch: Partial<CalendarItem> = {}
): CalendarItem {
    return {
        id: "item",
        guildId: "guild",
        title: "Recurring",
        color: "#000000",
        allDay: false,
        startAt,
        endAt: new Date(Date.parse(startAt) + 3600000).toISOString(),
        recurrence: { frequency, interval: 1 },
        createdAt: startAt,
        updatedAt: startAt,
        ...patch,
    }
}
test("old unlimited weekly series seek into the requested range and retain occurrence identity", () => {
    const rows = expandCalendarItems(
        [item("2010-01-04T12:00:00Z", "weekly")],
        new Date("2026-11-01"),
        new Date("2026-12-01")
    )
    assert.equal(rows.length, 5)
    assert.equal(rows[0].startAt, "2026-11-02T12:00:00.000Z")
    assert.equal(rows[0].id, "item:878")
})
test("short months and leap years skip invalid slots without duplicate dates", () => {
    const months = expandCalendarItems(
        [item("2020-01-31T12:00:00Z", "monthly_date")],
        new Date("2026-01-01"),
        new Date("2026-06-01")
    )
    assert.deepEqual(
        months.map((row) => row.startAt.slice(0, 10)),
        ["2026-01-31", "2026-03-31", "2026-05-31"]
    )
    assert.equal(new Set(months.map((row) => row.startAt)).size, months.length)
    const leap = expandCalendarItems(
        [item("2000-02-29T12:00:00Z", "yearly")],
        new Date("2023-01-01"),
        new Date("2030-01-01")
    )
    assert.deepEqual(
        leap.map((row) => row.startAt.slice(0, 10)),
        ["2024-02-29", "2028-02-29"]
    )
})
test("overlaps, inclusive until and per-source nearest limits are respected", () => {
    const source = item("2010-01-04T12:00:00Z", "weekly", {
        endAt: "2010-01-07T12:00:00Z",
        recurrence: {
            frequency: "weekly",
            interval: 1,
            until: "2026-11-09T12:00:00Z",
        },
    })
    const rows = expandCalendarItems(
        [source],
        new Date("2026-11-04"),
        new Date("2027-01-01")
    )
    assert.deepEqual(
        rows.map((row) => row.startAt.slice(0, 10)),
        ["2026-11-02", "2026-11-09"]
    )
    assert.equal(
        expandCalendarItems(
            [source],
            new Date("2026-11-04"),
            new Date("2027-01-01"),
            { limitPerItem: 1 }
        ).length,
        1
    )
})
test("invalid intervals/dates are rejected and nth weekdays preserve fixed UTC times", () => {
    const source = item("2020-01-27T12:00:00Z", "monthly_nth_weekday")
    assert.equal(
        expandCalendarItems(
            [source],
            new Date("2026-02-01"),
            new Date("2026-03-01")
        )[0].startAt,
        "2026-02-23T12:00:00.000Z"
    )
    assert.deepEqual(
        expandCalendarItems(
            [{ ...source, startAt: "bad" }],
            new Date(),
            new Date()
        ),
        []
    )
    assert.deepEqual(
        expandCalendarItems(
            [{ ...source, recurrence: { frequency: "weekly", interval: 0 } }],
            new Date("2026-01-01"),
            new Date("2027-01-01")
        ),
        []
    )
})
