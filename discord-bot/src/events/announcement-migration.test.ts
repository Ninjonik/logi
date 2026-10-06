import assert from "node:assert/strict"
import test from "node:test"

import {
    ANNOUNCEMENT_LAYOUT_VERSION,
    ANNOUNCEMENT_MIGRATIONS_PER_MINUTE,
} from "../../../src/domain/events/announcement-migration"
import {
    finishAnnouncementMigration,
    runAnnouncementMigrationPass,
} from "./announcement-migration"

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
