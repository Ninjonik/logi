import assert from "node:assert/strict"
import test from "node:test"

import {
    SEED_TEST_CHANNEL,
    SEED_TEST_CONTROL_CHANNEL,
    SEED_TEST_ROLE,
    SEED_TEST_SERVER,
    boardSeedSettings,
    createSeedTestPorts,
    seedReading,
} from "@/infrastructure/testing/in-memory-seed"

import { startSeedManually } from "./start-seed"

const NOW = new Date("2026-10-10T15:40:00Z")
const HOUR = 3_600_000
const admin = { id: "100000000000000001", name: "Kowalski" }

function setup() {
    const env = createSeedTestPorts(NOW)
    env.store.addPlan(SEED_TEST_SERVER, boardSeedSettings())
    env.players.set(SEED_TEST_SERVER, seedReading(12, NOW.getTime() - 30_000))
    return env
}
const start = (
    env: ReturnType<typeof setup>,
    overrides: Partial<Parameters<typeof startSeedManually>[1]> = {}
) =>
    startSeedManually(env.ports, {
        server: SEED_TEST_SERVER,
        actor: admin,
        via: "discord",
        channelId: SEED_TEST_CONTROL_CHANNEL,
        requestKey: "interaction-1",
        ...overrides,
    })

test("an admin's start records the run, pings the role and asks for the call and control message", async () => {
    const env = setup()
    const result = await start(env)
    assert.equal(result.kind, "started")
    if (result.kind !== "started") return
    const { run } = result
    assert.equal(run.status, "seeding")
    assert.equal(run.channelId, SEED_TEST_CHANNEL)
    assert.equal(run.serverName, "Vlci #1 · Public")
    assert.deepEqual(run.trigger, {
        kind: "manual",
        actor: admin,
        via: "discord",
        channelId: SEED_TEST_CONTROL_CHANNEL,
    })
    assert.deepEqual(run.ping, { kind: "role", roleId: SEED_TEST_ROLE })
    assert.equal(run.players.start, 12)
    const plan = await env.store.plan(SEED_TEST_SERVER)
    assert.equal(plan?.state.activeRunId, run.id)
    assert.equal(plan?.state.lastStartedAt, NOW.getTime())
    assert.equal(plan?.state.lastPingAt, NOW.getTime())
    assert.deepEqual(env.messages.requests, [
        { kind: "call", runId: run.id, status: "seeding" },
        { kind: "control", connectionId: SEED_TEST_SERVER.connectionId },
    ])
})

test("a web start records no channel and the same click is never started twice", async () => {
    const env = setup()
    const first = await start(env, { via: "web", requestKey: "web-1" })
    assert.equal(first.kind, "started")
    assert.equal(
        first.kind === "started" &&
            first.run.trigger.kind === "manual" &&
            first.run.trigger.channelId,
        null
    )
    const again = await start(env, { via: "web", requestKey: "web-1" })
    assert.equal(again.kind, "duplicate")
    assert.equal(env.store.runs.size, 1)
})

test("a second start while seeding is refused with the running seed", async () => {
    const env = setup()
    const first = await start(env)
    const second = await start(env, { requestKey: "interaction-2" })
    assert.equal(second.kind, "refused")
    if (second.kind !== "refused" || first.kind !== "started") return
    assert.deepEqual(second.refusal, { kind: "running" })
    assert.equal(second.run?.id, first.run.id)
})

test("the cooldown refusal names the next start (P5-31)", async () => {
    const env = setup()
    env.store.addPlan(SEED_TEST_SERVER, boardSeedSettings(), {
        lastStartedAt: NOW.getTime() - 40 * 60_000,
    })
    assert.deepEqual(await start(env), {
        kind: "refused",
        refusal: {
            kind: "cooldown",
            retryAt: NOW.getTime() + 80 * 60_000,
            remainingMs: 80 * 60_000,
        },
    })
})

test("a seed inside the ping window runs without a ping, also across servers sharing the role", async () => {
    const env = setup()
    env.store.addPlan(SEED_TEST_SERVER, boardSeedSettings(), {
        lastStartedAt: NOW.getTime() - 2 * HOUR - 60_000,
        lastPingAt: NOW.getTime() - 2 * HOUR - 60_000,
    })
    const result = await start(env)
    assert.equal(result.kind, "started")
    if (result.kind !== "started") return
    assert.equal(result.run.ping.kind, "silent")
    const plan = await env.store.plan(SEED_TEST_SERVER)
    assert.equal(
        plan?.state.lastPingAt,
        NOW.getTime() - 2 * HOUR - 60_000,
        "a silent seed does not move the ping window"
    )

    const shared = setup()
    const other = {
        ...SEED_TEST_SERVER,
        connectionId: "gameDataConnections:wd",
    }
    shared.store.addPlan(other, boardSeedSettings(), {
        lastPingAt: NOW.getTime() - HOUR,
    })
    const sharedResult = await start(shared)
    assert.equal(
        sharedResult.kind === "started" && sharedResult.run.ping.kind,
        "silent"
    )
})

test("refusals: no plan, plan off, already live, offline, unknown server", async () => {
    const empty = createSeedTestPorts(NOW)
    empty.players.set(SEED_TEST_SERVER, seedReading(12, NOW.getTime()))
    assert.deepEqual(await start(empty), {
        kind: "refused",
        refusal: { kind: "not_configured" },
    })

    const off = setup()
    off.store.addPlan(SEED_TEST_SERVER, boardSeedSettings({ enabled: false }))
    assert.deepEqual(await start(off), {
        kind: "refused",
        refusal: { kind: "disabled" },
    })

    const live = setup()
    live.players.set(SEED_TEST_SERVER, seedReading(41, NOW.getTime()))
    assert.deepEqual(await start(live), {
        kind: "refused",
        refusal: { kind: "already_live", players: 41 },
    })

    const offline = setup()
    offline.players.set(
        SEED_TEST_SERVER,
        seedReading(0, NOW.getTime(), { online: false })
    )
    assert.deepEqual(await start(offline), {
        kind: "refused",
        refusal: { kind: "offline" },
    })

    const gone = setup()
    gone.players.set(SEED_TEST_SERVER, null)
    assert.deepEqual(await start(gone), { kind: "not_found" })
    assert.equal(gone.store.runs.size, 0)
})

test("without fresh data the admin may still start; the run has no starting count", async () => {
    const env = setup()
    env.players.set(
        SEED_TEST_SERVER,
        seedReading(12, NOW.getTime() - 3_600_000, { fresh: false })
    )
    const result = await start(env)
    assert.equal(result.kind, "started")
    assert.equal(result.kind === "started" && result.run.players.start, null)
})
