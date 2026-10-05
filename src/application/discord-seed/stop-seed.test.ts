import assert from "node:assert/strict"
import test from "node:test"

import {
    SEED_TEST_SERVER,
    boardSeedSettings,
    createSeedTestPorts,
    seedReading,
} from "@/infrastructure/testing/in-memory-seed"

import { startSeedManually } from "./start-seed"
import { stopSeed } from "./stop-seed"

const NOW = new Date("2026-10-10T15:40:00Z")
const admin = { id: "100000000000000001", name: "Hráč 01" }

async function running() {
    const env = createSeedTestPorts(NOW)
    env.store.addPlan(SEED_TEST_SERVER, boardSeedSettings())
    env.players.set(SEED_TEST_SERVER, seedReading(9, NOW.getTime()))
    const started = await startSeedManually(env.ports, {
        server: SEED_TEST_SERVER,
        actor: admin,
        via: "web",
        channelId: null,
        requestKey: "web-1",
    })
    assert.equal(started.kind, "started")
    env.messages.requests = []
    env.clock.set(new Date(NOW.getTime() + 20 * 60_000))
    return env
}

test("an admin ends a running seed: the call shows the end, the server is free", async () => {
    const env = await running()
    const result = await stopSeed(env.ports, {
        server: SEED_TEST_SERVER,
        actor: admin,
        via: "discord",
    })
    assert.equal(result.kind, "stopped")
    if (result.kind !== "stopped") return
    assert.equal(result.run.status, "ended_admin")
    assert.equal(result.run.endedAt, NOW.getTime() + 20 * 60_000)
    assert.deepEqual(result.run.endedBy, { ...admin, via: "discord" })
    assert.equal(
        (await env.store.plan(SEED_TEST_SERVER))?.state.activeRunId,
        null
    )
    assert.deepEqual(env.messages.requests, [
        { kind: "call", runId: result.run.id, status: "ended_admin" },
        { kind: "control", connectionId: SEED_TEST_SERVER.connectionId },
    ])
})

test("stopping twice, or with nothing running, changes nothing", async () => {
    const env = await running()
    await stopSeed(env.ports, {
        server: SEED_TEST_SERVER,
        actor: admin,
        via: "web",
    })
    env.messages.requests = []
    assert.deepEqual(
        await stopSeed(env.ports, {
            server: SEED_TEST_SERVER,
            actor: admin,
            via: "web",
        }),
        { kind: "not_running" }
    )
    assert.deepEqual(env.messages.requests, [])
    const none = createSeedTestPorts(NOW)
    assert.deepEqual(
        await stopSeed(none.ports, {
            server: SEED_TEST_SERVER,
            actor: admin,
            via: "web",
        }),
        { kind: "not_running" }
    )
})

test("a pointer to a run that already ended is repaired", async () => {
    const env = await running()
    const plan = (await env.store.plan(SEED_TEST_SERVER))!
    const run = (await env.store.run(plan.state.activeRunId!))!
    await env.store.saveRun({ ...run, status: "live", endedAt: NOW.getTime() })
    assert.deepEqual(
        await stopSeed(env.ports, {
            server: SEED_TEST_SERVER,
            actor: admin,
            via: "web",
        }),
        { kind: "not_running" }
    )
    assert.equal(
        (await env.store.plan(SEED_TEST_SERVER))?.state.activeRunId,
        null
    )
    assert.equal((await env.store.run(run.id))?.status, "live")
})
