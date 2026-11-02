import assert from "node:assert/strict"
import test from "node:test"

import { calendarItemCreateSchema } from "./calendar-item"

test("calendar item schema accepts an ordered ISO range", () => {
    const parsed = calendarItemCreateSchema.safeParse({
        title: "  Scrim night ",
        startAt: "2026-10-05T18:00:00.000Z",
        endAt: "2026-10-05T20:00:00.000Z",
    })
    assert.equal(parsed.success, true)
    assert.equal(parsed.data?.title, "Scrim night")
})

test("calendar item schema rejects reversed ranges, bad dates and extra fields", () => {
    for (const input of [
        {
            title: "Scrim",
            startAt: "2026-10-05T20:00:00.000Z",
            endAt: "2026-10-05T18:00:00.000Z",
        },
        { title: "Scrim", startAt: "tomorrow", endAt: "2026-10-05T18:00:00Z" },
        {
            title: " ",
            startAt: "2026-10-05T18:00:00Z",
            endAt: "2026-10-05T19:00:00Z",
        },
        {
            title: "Scrim",
            startAt: "2026-10-05T18:00:00Z",
            endAt: "2026-10-05T19:00:00Z",
            guildId: "other",
        },
    ])
        assert.equal(calendarItemCreateSchema.safeParse(input).success, false)
})

test("calendar item schema accepts colors and every supported recurrence", () => {
    for (const frequency of [
        "weekly",
        "monthly_date",
        "monthly_nth_weekday",
        "yearly",
    ]) {
        const parsed = calendarItemCreateSchema.parse({
            title: "Clan meeting",
            startAt: "2030-01-01T18:00:00Z",
            endAt: "2030-01-01T19:00:00Z",
            color: "#123abc",
            recurrence: {
                frequency,
                interval: 2,
                until: "2031-01-01T23:59:00Z",
            },
        })
        assert.equal(parsed.color, "#123abc")
        assert.equal(parsed.recurrence?.frequency, frequency)
    }
})

test("calendar item schema rejects invalid colors and recurrence settings", () => {
    const fields = {
        title: "Meeting",
        startAt: "2030-01-01T18:00:00Z",
        endAt: "2030-01-01T19:00:00Z",
    }
    for (const extra of [
        { color: "red" },
        { recurrence: { frequency: "daily", interval: 1 } },
        { recurrence: { frequency: "weekly", interval: 0 } },
        { recurrence: { frequency: "weekly", interval: 1.5 } },
        { recurrence: { frequency: "weekly", interval: 1, until: "invalid" } },
    ])
        assert.equal(
            calendarItemCreateSchema.safeParse({ ...fields, ...extra }).success,
            false
        )
    assert.equal(calendarItemCreateSchema.parse(fields).color, "#7c3aed")
})
