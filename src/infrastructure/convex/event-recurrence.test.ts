import * as eventRecurrence from "../../../convex/eventRecurrence"
import { invoke, testContext } from "./testing/database"
import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"

/**
 * The recurrence pass over the fake database: it extends weekly series two
 * weeks ahead without reading the whole `events` table, which production
 * runs on a timer (ARCHITECTURE.md, "Convex hot paths").
 */

const secret = ["synthetic", "recurrence", "secret"].join("-")
const guildId = "910000000000000002"
// A Tuesday evening in Prague, an hour into this week's occurrence; the
// series started a week earlier at 20:00 Prague (18:00 UTC in summer time).
const NOW = Date.parse("2026-10-06T19:00:00.000Z")
const SERIES_START = "2026-09-29T18:00:00.000Z"

function matchFields(name: string, gameStart: string) {
    const start = Date.parse(gameStart)
    const iso = (offsetMinutes: number) =>
        new Date(start + offsetMinutes * 60_000).toISOString()
    return {
        guildId,
        kind: "match",
        name,
        registrationEnd: iso(-60),
        meetingStart: iso(-30),
        gameStart,
        gameEnd: iso(120),
        pingClan: false,
        participants: [],
        createdAt: SERIES_START,
    }
}

function fixture(t: TestContext) {
    process.env.INTERNAL_AUTH_SECRET = secret
    // The handler reads the clock with `new Date()`, which only the timer
    // mock replaces.
    t.mock.timers.enable({ apis: ["Date"], now: NOW })
    const ctx = testContext()
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:vlci",
        guildId,
        timezone: "Europe/Prague",
    })
    const weekly = { frequency: "weekly", interval: 1, weekdays: [2] }
    ctx.db.seed("events", {
        _id: "events:series",
        ...matchFields("Tuesday scrim", SERIES_START),
        recurrence: weekly,
    })
    // An occurrence the last pass already created, already under way: it
    // starts before now, so the pass does not even read it, and it is never
    // created twice because a pass only creates starts after now.
    ctx.db.seed("events", {
        _id: "events:first",
        ...matchFields("Tuesday scrim", "2026-10-06T18:00:00.000Z"),
        recurrenceSeriesId: "events:series",
    })
    // A monthly series, a draft, a training and a stopped series are skipped.
    ctx.db.seed("events", {
        _id: "events:monthly",
        ...matchFields("Monthly", SERIES_START),
        recurrence: { ...weekly, frequency: "monthly_date", monthDay: 1 },
    })
    ctx.db.seed("events", {
        _id: "events:draft",
        ...matchFields("Draft series", SERIES_START),
        recurrence: weekly,
        isDraft: true,
    })
    ctx.db.seed("events", {
        _id: "events:training",
        ...matchFields("Training", SERIES_START),
        kind: "training",
        recurrence: weekly,
    })
    ctx.db.seed("events", {
        _id: "events:stopped",
        ...matchFields("Stopped", SERIES_START),
    })
    return ctx
}

const reads = (ctx: ReturnType<typeof testContext>, t: TestContext) => {
    const calls: Array<{ table: string; index: string | null }> = []
    const original = ctx.db.query.bind(ctx.db)
    t.mock.method(ctx.db, "query", (table: string) => {
        const query = original(table)
        const call = { table, index: null as string | null }
        calls.push(call)
        const withIndex = query.withIndex
        query.withIndex = (name: string, fn?: (q: unknown) => unknown) => {
            call.index = name
            return withIndex(name, fn)
        }
        return query
    })
    return calls
}

test("weekly series gain their next two weeks through the series indexes, never a whole-table read", async (t) => {
    const ctx = fixture(t)
    const calls = reads(ctx, t)
    const result = await invoke(eventRecurrence.generateDue, ctx, { secret })
    const created = ctx.db.tables.events.filter(
        (event) => event.recurrenceSeriesId === "events:series"
    )
    assert.deepEqual(created.map((event) => event.gameStart).sort(), [
        "2026-10-06T18:00:00.000Z",
        "2026-10-13T18:00:00.000Z",
        "2026-10-20T18:00:00.000Z",
    ])
    assert.deepEqual(
        result.created.map((item: { guildId: string }) => item.guildId),
        [guildId, guildId]
    )
    const occurrence = created.find(
        (event) => event.gameStart === "2026-10-13T18:00:00.000Z"
    )
    assert.equal(occurrence?.recurrence, undefined)
    assert.equal(occurrence?.gameEnd, "2026-10-13T20:00:00.000Z")
    assert.equal(occurrence?.name, "Tuesday scrim")
    // The other series kinds created nothing.
    assert.equal(ctx.db.tables.events.length, 6 + 2)
    const eventReads = calls.filter((call) => call.table === "events")
    assert.ok(eventReads.length > 0)
    assert.deepEqual(
        [...new Set(eventReads.map((call) => call.index))].sort(),
        ["recurrenceSeriesId_gameStart", "recurrence_frequency"]
    )
})

test("a second pass in the same window creates nothing more", async (t) => {
    const ctx = fixture(t)
    await invoke(eventRecurrence.generateDue, ctx, { secret })
    const again = await invoke(eventRecurrence.generateDue, ctx, { secret })
    assert.deepEqual(again.created, [])
    assert.equal(ctx.db.tables.events.length, 6 + 2)
})

test("the pass needs the internal secret", async (t) => {
    const ctx = fixture(t)
    await assert.rejects(
        invoke(eventRecurrence.generateDue, ctx, { secret: "wrong" })
    )
    assert.equal(ctx.db.tables.events.length, 6)
})
