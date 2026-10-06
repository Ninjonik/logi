import assert from "node:assert/strict"
import test from "node:test"

import {
    SEED_TEST_SERVER,
    boardSeedSettings,
    createSeedTestPorts,
    seedReading,
} from "@/infrastructure/testing/in-memory-seed"

import {
    seedPanelPlayers,
    seedPanelProgress,
    toSeedPanelState,
} from "./panel-state"
import { startResultView, stopResultView } from "./action-result"
import { startSeedManually } from "./start-seed"

const NOW = new Date("2026-10-10T15:40:00Z")

async function started() {
    const env = createSeedTestPorts(NOW)
    env.store.addPlan(SEED_TEST_SERVER, boardSeedSettings())
    env.players.set(SEED_TEST_SERVER, seedReading(12, NOW.getTime()))
    const result = await startSeedManually(env.ports, {
        server: SEED_TEST_SERVER,
        actor: { id: "100000000000000001", name: "Kowalski" },
        via: "web",
        channelId: null,
        requestKey: "web-1",
    })
    if (result.kind !== "started") throw new Error(result.kind)
    return result
}

test("start answers carry no actor IDs and name the next allowed time", async () => {
    const result = await started()
    const view = startResultView(result)
    assert.deepEqual(view, {
        status: "started",
        runId: result.run.id,
        startedAt: NOW.toISOString(),
        channelId: result.run.channelId,
        pinged: true,
    })
    assert.equal(JSON.stringify(view).includes("100000000000000001"), false)
    assert.deepEqual(
        startResultView({
            kind: "refused",
            refusal: {
                kind: "cooldown",
                retryAt: Date.parse("2026-10-10T18:25:00Z"),
                remainingMs: 1,
            },
        }),
        { status: "cooldown", retryAt: "2026-10-10T18:25:00.000Z" }
    )
    assert.deepEqual(
        startResultView({
            kind: "refused",
            refusal: { kind: "running" },
            run: result.run,
        }),
        { status: "running", runId: result.run.id }
    )
    assert.deepEqual(
        startResultView({
            kind: "refused",
            refusal: { kind: "already_live", players: 41 },
        }),
        { status: "unavailable", reason: "already_live" }
    )
    assert.deepEqual(startResultView({ kind: "duplicate", run: result.run }), {
        status: "duplicate",
        runId: result.run.id,
    })
    assert.deepEqual(startResultView({ kind: "not_found" }), {
        status: "not_found",
    })
})

test("stop answers", async () => {
    const result = await started()
    assert.deepEqual(stopResultView({ kind: "stopped", run: result.run }), {
        status: "stopped",
        runId: result.run.id,
    })
    assert.deepEqual(stopResultView({ kind: "not_running" }), {
        status: "unavailable",
        reason: "not_running",
    })
})

test("the panel's seed mode links the call once posted and shares the progress", async () => {
    const { run } = await started()
    assert.deepEqual(toSeedPanelState(run, null), {
        connectionId: SEED_TEST_SERVER.connectionId,
        runId: run.id,
        startedAt: NOW.getTime(),
        liveFrom: 40,
        players: run.players.latest,
        call: null,
    })
    assert.deepEqual(toSeedPanelState(run, "message-1")?.call, {
        channelId: run.channelId,
        messageId: "message-1",
    })
    assert.equal(
        toSeedPanelState({ ...run, status: "live" }, "message-1"),
        null
    )
    assert.equal(
        seedPanelProgress({ liveFrom: 40, players: 12 }, 15).bar,
        "▰▰▰▱▱▱▱▱▱▱",
        "P5-15 shows the call's bar"
    )
})

test("the panel counts players from the run's reading, as the call does (P5-16)", () => {
    assert.equal(seedPanelPlayers({ players: 12 }, 15), 12)
    assert.equal(seedPanelPlayers({ players: 0 }, 3), 0)
    assert.equal(
        seedPanelPlayers({ players: null }, 15),
        15,
        "the panel's own count until the run has a reading"
    )
    assert.equal(seedPanelProgress({ liveFrom: 40, players: 31 }, 12).filled, 8)
})
