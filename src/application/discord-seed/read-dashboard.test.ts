import assert from "node:assert/strict"
import test from "node:test"

import {
    SEED_TEST_SERVER,
    boardSeedSettings,
    createSeedTestPorts,
    seedReading,
} from "@/infrastructure/testing/in-memory-seed"
import { defaultSeedPlanSettings } from "@/domain/discord-seed/plan"

import { readSeedDashboard } from "./read-dashboard"
import { startSeedManually } from "./start-seed"

// Monday 2026-10-05 13:00 Prague.
const NOW = new Date("2026-10-05T11:00:00Z")
const MINUTE = 60_000

test("an unconfigured server shows the defaults and its live reading", async () => {
    const env = createSeedTestPorts(NOW)
    env.players.set(SEED_TEST_SERVER, seedReading(12, NOW.getTime() - 40_000))
    const view = await readSeedDashboard(env.ports, SEED_TEST_SERVER)
    assert.ok(view)
    assert.equal(view.configured, false)
    assert.equal(view.revision, null)
    assert.deepEqual(view.settings, defaultSeedPlanSettings())
    assert.deepEqual(view.status, {
        players: 12,
        capacity: 100,
        map: "Foy",
        observedAt: new Date(NOW.getTime() - 40_000).toISOString(),
        fresh: true,
        serverStatus: "below_start",
        running: false,
        nextScheduledAt: null,
        lastStartedAt: null,
        cooldownUntil: null,
    })
    assert.equal(view.activeRun, null)
    assert.deepEqual(view.history.entries, [])
})

test("the status row names the next scheduled seed in the clan's zone (P3-04)", async () => {
    const env = createSeedTestPorts(NOW)
    env.store.timeZones.set(SEED_TEST_SERVER.guildId, "Europe/Prague")
    env.store.addPlan(SEED_TEST_SERVER, boardSeedSettings())
    env.players.set(SEED_TEST_SERVER, seedReading(12, NOW.getTime()))
    const view = await readSeedDashboard(env.ports, SEED_TEST_SERVER)
    assert.equal(view?.status.nextScheduledAt, "2026-10-05T15:00:00.000Z")
})

test("a running seed shows its progress, cooldown and history row", async () => {
    const env = createSeedTestPorts(NOW)
    env.store.addPlan(SEED_TEST_SERVER, boardSeedSettings())
    env.players.set(SEED_TEST_SERVER, seedReading(12, NOW.getTime()))
    const started = await startSeedManually(env.ports, {
        server: SEED_TEST_SERVER,
        actor: { id: "100000000000000001", name: "Hráč 01" },
        via: "web",
        channelId: null,
        requestKey: "web-1",
    })
    assert.equal(started.kind, "started")
    env.clock.set(new Date(NOW.getTime() + 20 * MINUTE))
    const view = await readSeedDashboard(env.ports, SEED_TEST_SERVER)
    assert.ok(view?.activeRun)
    assert.equal(view.status.running, true)
    assert.equal(view.activeRun.progress.bar, "▰▰▰▱▱▱▱▱▱▱")
    assert.deepEqual(view.activeRun.trigger, {
        kind: "manual",
        actorName: "Hráč 01",
        via: "web",
        channelId: null,
    })
    assert.equal(view.activeRun.callPosted, false)
    assert.equal(
        view.status.cooldownUntil,
        new Date(NOW.getTime() + 120 * MINUTE).toISOString()
    )
    assert.equal(view.history.entries.length, 1)
    assert.equal(view.history.entries[0].outcome, "running")
    assert.equal(view.history.entries[0].durationMinutes, 20)
    assert.deepEqual(view.history.summary, {
        days: 30,
        count: 1,
        liveCount: 0,
        averageMinutesToLive: null,
    })
})

test("a server outside the clan has no dashboard", async () => {
    const env = createSeedTestPorts(NOW)
    assert.equal(await readSeedDashboard(env.ports, SEED_TEST_SERVER), null)
})
