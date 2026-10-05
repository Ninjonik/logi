import assert from "node:assert/strict"
import test from "node:test"

import { ANNOUNCEMENT_MIGRATIONS_PER_MINUTE } from "../../../src/domain/events/announcement-migration"
import { runAnnouncementMigrationPass } from "./announcement-migration"

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
