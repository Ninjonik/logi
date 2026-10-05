import assert from "node:assert/strict"
import test from "node:test"

import {
    SEED_TEST_SERVER,
    boardSeedSettings,
    createSeedTestPorts,
    seedReading,
} from "@/infrastructure/testing/in-memory-seed"
import type {
    SeedPlanSettings,
    SeedPlanState,
} from "@/domain/discord-seed/plan"

import { evaluateSeedPlan } from "./tick"

const MINUTE = 60_000
// Monday 2026-10-05 17:01 in Prague: the Po–Pá 17:00 slot is due.
const SLOT = new Date("2026-10-05T15:01:00Z")

function setup(
    now = SLOT,
    settings: Partial<SeedPlanSettings> = {},
    state: Partial<SeedPlanState> = {}
) {
    const env = createSeedTestPorts(now)
    env.store.timeZones.set(SEED_TEST_SERVER.guildId, "Europe/Prague")
    env.store.addPlan(SEED_TEST_SERVER, boardSeedSettings(settings), state)
    return env
}
async function tick(env: ReturnType<typeof setup>, players: number | null) {
    const now = env.clock.now().getTime()
    if (players !== null)
        env.players.set(SEED_TEST_SERVER, seedReading(players, now - 5_000))
    const plan = (await env.store.plan(SEED_TEST_SERVER))!
    return evaluateSeedPlan(env.ports, plan, now)
}
const advance = (env: ReturnType<typeof setup>, minutes: number) =>
    env.clock.set(new Date(env.clock.now().getTime() + minutes * MINUTE))
const state = async (env: ReturnType<typeof setup>) =>
    (await env.store.plan(SEED_TEST_SERVER))!.state

test("a scheduled seed runs from the slot to live, and duplicate ticks do nothing extra", async () => {
    const env = setup()
    const started = await tick(env, 11)
    assert.deepEqual(
        {
            kind: started.kind,
            trigger: "trigger" in started && started.trigger,
        },
        { kind: "started", trigger: "schedule" }
    )
    const runId = (await state(env)).activeRunId!
    assert.equal((await state(env)).consumedOccurrence, "2026-10-05T17:00")
    assert.equal((await env.store.run(runId))?.players.start, 11)

    // The same minute delivered twice: no second seed, no new message.
    env.messages.requests = []
    assert.deepEqual(await tick(env, 11), { kind: "idle" })
    assert.equal(env.store.runs.size, 1)
    assert.deepEqual(env.messages.requests, [])

    await env.store.saveRun({
        ...(await env.store.run(runId))!,
        callPostedAt: SLOT.getTime() + 2_000,
    })
    advance(env, 20)
    assert.deepEqual(await tick(env, 31), { kind: "progressed", runId })
    assert.deepEqual(env.messages.requests, [
        { kind: "call", runId, status: "seeding" },
    ])

    advance(env, 22)
    env.messages.requests = []
    assert.deepEqual(await tick(env, 41), {
        kind: "ended",
        runId,
        status: "live",
    })
    const run = (await env.store.run(runId))!
    assert.equal(run.players.end, 41)
    assert.equal(run.endedAt, env.clock.now().getTime() - 5_000)
    assert.equal((await state(env)).activeRunId, null)
    assert.equal((await state(env)).phase, "live")
    assert.deepEqual(env.messages.requests, [
        { kind: "call", runId, status: "live" },
        { kind: "control", connectionId: SEED_TEST_SERVER.connectionId },
    ])

    advance(env, 1)
    assert.deepEqual(await tick(env, 42), { kind: "idle" })
    assert.equal(env.store.runs.size, 1)
})

test("a seed that never reaches the threshold ends at the maximum duration", async () => {
    const env = setup()
    await tick(env, 14)
    const runId = (await state(env)).activeRunId!
    await env.store.saveRun({
        ...(await env.store.run(runId))!,
        callPostedAt: SLOT.getTime(),
    })
    advance(env, 119)
    assert.equal((await tick(env, 31)).kind, "progressed")
    advance(env, 1)
    assert.deepEqual(await tick(env, 31), {
        kind: "ended",
        runId,
        status: "ended_timeout",
    })
    const run = (await env.store.run(runId))!
    assert.equal(run.endedAt, SLOT.getTime() + 120 * MINUTE)
    assert.equal(run.players.end, 31)
})

test("a run whose server disappeared fails and frees the plan", async () => {
    const env = setup()
    await tick(env, 14)
    const runId = (await state(env)).activeRunId!
    env.players.set(SEED_TEST_SERVER, null)
    advance(env, 1)
    const plan = (await env.store.plan(SEED_TEST_SERVER))!
    assert.deepEqual(
        await evaluateSeedPlan(env.ports, plan, env.clock.now().getTime()),
        { kind: "ended", runId, status: "failed" }
    )
    assert.equal((await env.store.run(runId))?.failure, "server_unavailable")
    assert.equal((await state(env)).activeRunId, null)
})

test("a call the bot never posted fails the run after the delivery deadline", async () => {
    const env = setup()
    await tick(env, 14)
    const runId = (await state(env)).activeRunId!
    advance(env, 10)
    assert.deepEqual(await tick(env, 15), {
        kind: "ended",
        runId,
        status: "failed",
    })
    assert.equal((await env.store.run(runId))?.failure, "call_not_delivered")
})

test("a slot at or above the start threshold is skipped and consumed", async () => {
    const env = setup()
    assert.deepEqual(await tick(env, 25), {
        kind: "skipped",
        reason: "not_below_start",
    })
    assert.equal((await state(env)).consumedOccurrence, "2026-10-05T17:00")
    advance(env, 1)
    assert.deepEqual(
        await tick(env, 21),
        { kind: "idle" },
        "the slot does not fire again inside its grace window"
    )
})

test("a slot without fresh data waits inside the grace window and starts once data arrives", async () => {
    const env = setup()
    env.players.set(
        SEED_TEST_SERVER,
        seedReading(12, SLOT.getTime() - 3_600_000, { fresh: false })
    )
    const plan = (await env.store.plan(SEED_TEST_SERVER))!
    assert.deepEqual(await evaluateSeedPlan(env.ports, plan, SLOT.getTime()), {
        kind: "skipped",
        reason: "no_data",
    })
    assert.equal((await state(env)).consumedOccurrence, null)
    advance(env, 3)
    assert.equal((await tick(env, 12)).kind, "started")
})

test("a paused server panel blocks scheduled seeds", async () => {
    const env = setup()
    env.store.pause(SEED_TEST_SERVER)
    assert.deepEqual(await tick(env, 12), {
        kind: "skipped",
        reason: "paused",
    })
    assert.equal(env.store.runs.size, 0)
})

test("the automatic trigger starts when the server empties inside its window", async () => {
    // Monday 19:30 Prague, no slot due.
    const env = setup(new Date("2026-10-05T17:30:00Z"))
    const result = await tick(env, 12)
    assert.equal(result.kind, "started")
    assert.equal("trigger" in result && result.trigger, "auto")
    const after = await state(env)
    assert.equal(after.lastAutoStartAt, env.clock.now().getTime())
    const run = (await env.store.run(after.activeRunId!))!
    assert.deepEqual(run.trigger, { kind: "auto", below: 20 })
})

test("hysteresis memory and the live mark are stored, and only transitions refresh the control message", async () => {
    const env = setup(new Date("2026-10-05T10:00:00Z"))
    await tick(env, 41)
    assert.equal((await state(env)).phase, "live")
    assert.equal((await state(env)).lastLiveAt, env.clock.now().getTime())
    assert.deepEqual(env.messages.requests, [
        { kind: "control", connectionId: SEED_TEST_SERVER.connectionId },
    ])
    env.messages.requests = []
    advance(env, 1)
    await tick(env, 36)
    assert.equal((await state(env)).phase, "live", "36 stays live")
    assert.deepEqual(env.messages.requests, [])
    advance(env, 1)
    await tick(env, 19)
    assert.equal((await state(env)).phase, "not_live")
    assert.deepEqual(env.messages.requests, [
        { kind: "control", connectionId: SEED_TEST_SERVER.connectionId },
    ])
})

test("a plan that is off only follows its running seed", async () => {
    const env = setup(SLOT, { enabled: false })
    assert.deepEqual(await tick(env, 12), { kind: "idle" })
    assert.equal(env.store.runs.size, 0)
})
