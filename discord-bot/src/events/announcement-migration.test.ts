import assert from "node:assert/strict"
import test from "node:test"

import {
    finishAnnouncementMigration,
    migrationPassDelayMs,
    runAnnouncementMigrationPass,
    startAnnouncementMigration,
} from "./announcement-migration"
import {
    ANNOUNCEMENT_LAYOUT_VERSION,
    ANNOUNCEMENT_MIGRATIONS_PER_MINUTE,
} from "../../../src/domain/events/announcement-migration"

function deps(due: string[]) {
    const queued: string[] = []
    let triggered = 0
    return {
        queued,
        triggered: () => triggered,
        deps: {
            listDue: async () =>
                due.map((eventId) => ({ eventId, guildId: "g" })),
            queueEventSync: (eventId: string) => queued.push(eventId),
            triggerSoon: () => {
                triggered += 1
            },
        },
    }
}

test("each pass queues at most a minute's worth of old cards (L1-151)", async () => {
    const due = Array.from({ length: 20 }, (_, index) => `e${index}`)
    const run = deps(due)
    const remaining = await runAnnouncementMigrationPass(run.deps, new Map())
    assert.equal(remaining, 20)
    assert.equal(run.queued.length, ANNOUNCEMENT_MIGRATIONS_PER_MINUTE)
    assert.equal(run.triggered(), 1)
})

test("a card that keeps failing is left for its next ordinary sync", async () => {
    const attempts = new Map<string, number>()
    for (let pass = 0; pass < 3; pass += 1)
        await runAnnouncementMigrationPass(deps(["stuck"]).deps, attempts)
    const run = deps(["stuck"])
    assert.equal(await runAnnouncementMigrationPass(run.deps, attempts), 0)
    assert.deepEqual(run.queued, [])
})

test("nothing due means the migration is done", async () => {
    const run = deps([])
    assert.equal(await runAnnouncementMigrationPass(run.deps, new Map()), 0)
    assert.equal(run.triggered(), 0)
})

test("a queued match without a card is marked done once its sync finished (L1-147, L1-B20)", async () => {
    const recorded: unknown[] = []
    const record = async (input: unknown) => {
        recorded.push(input)
    }
    const run = deps(["no-card", "with-card"])
    await runAnnouncementMigrationPass(run.deps, new Map())
    assert.deepEqual(run.queued, ["no-card", "with-card"])

    // The roster card and forum post were redrawn: the match is done.
    assert.equal(
        await finishAnnouncementMigration(
            { eventId: "no-card", guildId: "g", hasCard: false },
            record
        ),
        true
    )
    assert.deepEqual(recorded, [
        {
            eventId: "no-card",
            guildId: "g",
            migrationVersion: ANNOUNCEMENT_LAYOUT_VERSION,
        },
    ])
    // A card records its own layout when it is redrawn (rate-limited).
    assert.equal(
        await finishAnnouncementMigration(
            { eventId: "with-card", guildId: "g", hasCard: true },
            record
        ),
        false
    )
    // Idempotent: a second sync of the same match records nothing, and an
    // ordinary sync of a match the worker never queued records nothing.
    assert.equal(
        await finishAnnouncementMigration(
            { eventId: "no-card", guildId: "g", hasCard: false },
            record
        ),
        false
    )
    assert.equal(
        await finishAnnouncementMigration(
            { eventId: "ordinary", guildId: "g", hasCard: false },
            record
        ),
        false
    )
    assert.equal(recorded.length, 1)
})

test("a failed record leaves the match for the next pass", async () => {
    const run = deps(["flaky"])
    await runAnnouncementMigrationPass(run.deps, new Map())
    assert.equal(
        await finishAnnouncementMigration(
            { eventId: "flaky", guildId: "g", hasCard: false },
            async () => {
                throw new Error("backend unavailable")
            }
        ),
        false
    )
})

test("after three failed passes in a row the worker waits ten minutes, never retrying every minute", () => {
    assert.equal(migrationPassDelayMs(0), 60_000)
    assert.equal(migrationPassDelayMs(2), 60_000)
    assert.equal(migrationPassDelayMs(3), 600_000)
    assert.equal(migrationPassDelayMs(10), 600_000)
})

test("the worker backs off while the query keeps failing and recovers once it answers", async () => {
    const scheduled: Array<{ run: () => Promise<void>; delayMs: number }> = []
    let failing = true
    let due: string[] = ["old"]
    const stop = startAnnouncementMigration(
        { queueEventSync: () => {}, triggerSoon: () => {} },
        {
            listDue: async () => {
                if (failing) throw new Error("backend unavailable")
                return due.map((eventId) => ({ eventId, guildId: "g" }))
            },
            timers: {
                schedule: (run, delayMs) => {
                    scheduled.push({ run, delayMs })
                    return scheduled.length
                },
                cancel: () => {},
            },
        }
    )
    const next = async () => {
        const entry = scheduled[scheduled.length - 1]
        await entry.run()
        return scheduled[scheduled.length - 1].delayMs
    }
    assert.equal(
        scheduled[0].delayMs,
        90_000,
        "the start-up sync settles first"
    )
    assert.equal(await next(), 60_000, "first failure")
    assert.equal(await next(), 60_000, "second failure")
    assert.equal(await next(), 600_000, "third failure backs off")
    assert.equal(await next(), 600_000, "and stays backed off")
    failing = false
    assert.equal(await next(), 60_000, "an answer restores the minute cadence")
    failing = true
    assert.equal(await next(), 60_000, "the failure count restarted")
    failing = false
    due = []
    const before = scheduled.length
    await scheduled[before - 1].run()
    assert.equal(scheduled.length, before, "nothing due: the worker stops")
    stop()
})

test("a stopped worker schedules no further pass", async () => {
    const scheduled: Array<{ run: () => Promise<void>; delayMs: number }> = []
    const cancelled: unknown[] = []
    const stop = startAnnouncementMigration(
        { queueEventSync: () => {}, triggerSoon: () => {} },
        {
            listDue: async () => [{ eventId: "e", guildId: "g" }],
            timers: {
                schedule: (run, delayMs) => {
                    scheduled.push({ run, delayMs })
                    return scheduled.length
                },
                cancel: (handle) => cancelled.push(handle),
            },
        }
    )
    stop()
    assert.deepEqual(cancelled, [1])
    await scheduled[0].run()
    assert.equal(scheduled.length, 1)
})
