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
