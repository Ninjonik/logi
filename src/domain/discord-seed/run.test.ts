import assert from "node:assert/strict"
import test from "node:test"

import {
    SEED_CALL_DELIVERY_DEADLINE_MS,
    applySeedRunEvent,
    isSeedRunActive,
    seedRunSeeders,
    startSeedRun,
    type SeedRun,
} from "./run"

const MINUTE = 60_000
const START = Date.parse("2026-10-10T15:40:00Z")
const admin = { id: "100000000000000001", name: "Kowalski" }

function seeding(overrides: Partial<SeedRun> = {}): SeedRun {
    return {
        ...startSeedRun({
            trigger: {
                kind: "manual",
                actor: admin,
                via: "discord",
                channelId: null,
            },
            now: START,
            plan: { liveFrom: 40, maxDurationMinutes: 120, endAction: "edit" },
            ping: { kind: "role", roleId: "333333333333333333" },
            observation: {
                players: 12,
                capacity: 100,
                map: "Foy",
                observedAt: START - 30_000,
            },
        }),
        ...overrides,
    }
}
const seen = (players: number, minutes: number) => ({
    players,
    capacity: 100,
    map: "Foy",
    observedAt: START + minutes * MINUTE,
})
const posted = (run: SeedRun) =>
    applySeedRunEvent(run, {
        kind: "call_posted",
        at: START + 5_000,
        pingedMembers: 34,
    }).run

test("a run starts seeding with the plan's threshold, deadline and ping decision", () => {
    const run = seeding()
    assert.equal(run.status, "seeding")
    assert.equal(isSeedRunActive(run), true)
    assert.equal(run.deadlineAt, START + 120 * MINUTE)
    assert.equal(run.liveFrom, 40)
    assert.deepEqual(run.players, {
        start: 12,
        latest: 12,
        peak: 12,
        end: null,
        capacity: 100,
        map: "Foy",
        observedAt: START - 30_000,
    })
    assert.equal(run.callPostedAt, null)
})

test("a run may start without a reading", () => {
    const run = startSeedRun({
        trigger: { kind: "auto", below: 20 },
        now: START,
        plan: { liveFrom: 40, maxDurationMinutes: 60, endAction: "delete" },
        ping: { kind: "silent", reason: "no_role" },
        observation: null,
    })
    assert.equal(run.players.start, null)
    assert.equal(run.endAction, "delete")
    assert.equal(seedRunSeeders(run), null)
})

test("newer readings update progress; older or pre-start readings are ignored", () => {
    const run = posted(seeding())
    const step = applySeedRunEvent(run, {
        kind: "observe",
        at: START + MINUTE,
        observation: seen(31, 1),
    })
    assert.equal(step.changed, true)
    assert.equal(step.ended, false)
    assert.equal(step.run.players.latest, 31)
    assert.equal(step.run.players.peak, 31)
    for (const observation of [seen(35, 1), seen(35, -1)])
        assert.equal(
            applySeedRunEvent(step.run, {
                kind: "observe",
                at: START + 2 * MINUTE,
                observation,
            }).changed,
            false
        )
    const dip = applySeedRunEvent(step.run, {
        kind: "observe",
        at: START + 2 * MINUTE,
        observation: seen(28, 2),
    }).run
    assert.equal(dip.players.latest, 28)
    assert.equal(dip.players.peak, 31, "the peak keeps the best count")
})

test("the run goes live at the threshold and keeps the time and count", () => {
    const step = applySeedRunEvent(posted(seeding()), {
        kind: "observe",
        at: START + 46 * MINUTE,
        observation: seen(40, 45),
    })
    assert.equal(step.ended, true)
    assert.equal(step.run.status, "live")
    assert.equal(step.run.endedAt, START + 45 * MINUTE)
    assert.equal(step.run.players.end, 40)
    assert.equal(seedRunSeeders(step.run), 28)
    assert.equal(
        applySeedRunEvent(posted(seeding()), {
            kind: "observe",
            at: START + 46 * MINUTE,
            observation: seen(39, 45),
        }).run.status,
        "seeding"
    )
})

test("the run times out at the maximum duration below the threshold", () => {
    const step = applySeedRunEvent(posted(seeding()), {
        kind: "observe",
        at: START + 121 * MINUTE,
        observation: seen(31, 120.5),
    })
    assert.equal(step.run.status, "ended_timeout")
    assert.equal(step.run.endedAt, START + 120 * MINUTE)
    assert.equal(step.run.players.end, 31)
    assert.equal(
        applySeedRunEvent(posted(seeding()), {
            kind: "observe",
            at: START + 120 * MINUTE,
            observation: null,
        }).run.status,
        "ended_timeout",
        "the deadline itself ends the run, even without data"
    )
})

test("a live reading taken before the deadline wins over the timeout; one after it does not", () => {
    assert.equal(
        applySeedRunEvent(posted(seeding()), {
            kind: "observe",
            at: START + 121 * MINUTE,
            observation: seen(41, 119),
        }).run.status,
        "live"
    )
    assert.equal(
        applySeedRunEvent(posted(seeding()), {
            kind: "observe",
            at: START + 121 * MINUTE,
            observation: seen(41, 120.5),
        }).run.status,
        "ended_timeout"
    )
})

test("a call that never reached Discord fails the run after the delivery deadline", () => {
    const late = START + SEED_CALL_DELIVERY_DEADLINE_MS
    const step = applySeedRunEvent(seeding(), {
        kind: "observe",
        at: late,
        observation: null,
    })
    assert.equal(step.run.status, "failed")
    assert.equal(step.run.failure, "call_not_delivered")
    assert.equal(
        applySeedRunEvent(seeding(), {
            kind: "observe",
            at: late - 1,
            observation: null,
        }).run.status,
        "seeding"
    )
    assert.equal(
        applySeedRunEvent(posted(seeding()), {
            kind: "observe",
            at: late,
            observation: null,
        }).run.status,
        "seeding"
    )
})

test("the bot's delivery report is recorded once; a silent call has no pinged members", () => {
    const run = posted(seeding())
    assert.equal(run.callPostedAt, START + 5_000)
    assert.equal(run.pingedMembers, 34)
    assert.equal(
        applySeedRunEvent(run, {
            kind: "call_posted",
            at: START + 9_000,
            pingedMembers: 99,
        }).changed,
        false
    )
    assert.equal(
        posted(
            seeding({
                ping: {
                    kind: "silent",
                    reason: "ping_window",
                    windowMinutes: 240,
                    nextPingAt: START + MINUTE,
                },
            })
        ).pingedMembers,
        null
    )
})

test("an admin ends a run early once; repeated stops change nothing", () => {
    const step = applySeedRunEvent(posted(seeding()), {
        kind: "stop",
        at: START + 30 * MINUTE,
        actor: admin,
        via: "web",
    })
    assert.equal(step.run.status, "ended_admin")
    assert.equal(step.run.endedAt, START + 30 * MINUTE)
    assert.deepEqual(step.run.endedBy, { ...admin, via: "web" })
    assert.deepEqual(
        applySeedRunEvent(step.run, {
            kind: "stop",
            at: START + 31 * MINUTE,
            actor: admin,
            via: "discord",
        }),
        { run: step.run, changed: false, ended: false }
    )
})

test("terminal runs ignore every later event", () => {
    const failed = applySeedRunEvent(seeding(), {
        kind: "fail",
        at: START + MINUTE,
        reason: "channel_unavailable",
    }).run
    assert.equal(failed.status, "failed")
    assert.equal(failed.failure, "channel_unavailable")
    for (const event of [
        {
            kind: "observe" as const,
            at: START + 5 * MINUTE,
            observation: seen(45, 4),
        },
        {
            kind: "fail" as const,
            at: START,
            reason: "server_unavailable" as const,
        },
        { kind: "stop" as const, at: START, actor: admin, via: "web" as const },
    ])
        assert.equal(applySeedRunEvent(failed, event).changed, false)
})

test("seeders are the growth from the start to the peak", () => {
    assert.equal(
        seedRunSeeders({
            players: {
                start: 25,
                latest: 43,
                peak: 43,
                end: 43,
                capacity: 100,
                map: null,
                observedAt: null,
            },
        }),
        18,
        "P5-13 díky 18 seederům"
    )
})
