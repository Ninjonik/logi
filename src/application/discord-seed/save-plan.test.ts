import assert from "node:assert/strict"
import test from "node:test"

import {
    SEED_TEST_SERVER,
    boardSeedSettings,
    createSeedTestPorts,
    seedReading,
} from "@/infrastructure/testing/in-memory-seed"

import { saveSeedPlan } from "./save-plan"

const NOW = new Date("2026-10-05T12:00:00Z")

function setup() {
    const env = createSeedTestPorts(NOW)
    env.players.set(SEED_TEST_SERVER, seedReading(12, NOW.getTime()))
    return env
}
const save = (
    env: ReturnType<typeof setup>,
    overrides: Partial<Parameters<typeof saveSeedPlan>[1]> = {}
) =>
    saveSeedPlan(env.ports, {
        server: SEED_TEST_SERVER,
        settings: boardSeedSettings(),
        expectedRevision: null,
        updatedBy: "100000000000000001",
        ...overrides,
    })

test("the first save creates the plan and asks for the control message and intros", async () => {
    const env = setup()
    const result = await save(env)
    assert.equal(result.kind, "saved")
    assert.equal(result.kind === "saved" && result.plan.revision, 1)
    assert.deepEqual(env.messages.requests, [
        { kind: "control", connectionId: SEED_TEST_SERVER.connectionId },
        { kind: "intro", guildId: SEED_TEST_SERVER.guildId },
    ])
})

test("later saves need the current revision and keep the runtime state", async () => {
    const env = setup()
    await save(env)
    const plan = (await env.store.plan(SEED_TEST_SERVER))!
    await env.store.savePlanState(plan.id, {
        ...plan.state,
        lastStartedAt: 1,
        activeRunId: "run-7",
    })
    assert.deepEqual(await save(env, { expectedRevision: null }), {
        kind: "conflict",
        revision: 1,
    })
    assert.deepEqual(await save(env, { expectedRevision: 0 }), {
        kind: "conflict",
        revision: 1,
    })
    const saved = await save(env, {
        expectedRevision: 1,
        settings: boardSeedSettings({ liveFrom: 50, startBelow: 25 }),
    })
    assert.equal(saved.kind, "saved")
    const stored = (await env.store.plan(SEED_TEST_SERVER))!
    assert.equal(stored.revision, 2)
    assert.equal(stored.settings.liveFrom, 50)
    assert.equal(stored.state.activeRunId, "run-7")
    assert.equal(stored.state.lastStartedAt, 1)
})

test("invalid settings are reported by code and nothing is stored", async () => {
    const env = setup()
    assert.deepEqual(
        await save(env, {
            settings: boardSeedSettings({ startBelow: 45 }),
        }),
        {
            kind: "invalid",
            issues: [
                { path: "startBelow", code: "start_below_not_under_live" },
            ],
        }
    )
    const malformed = await save(env, { settings: { liveFrom: "40" } })
    assert.equal(malformed.kind, "invalid")
    if (malformed.kind === "invalid") {
        assert.ok(malformed.issues.every((issue) => issue.code === "invalid"))
        assert.ok(malformed.issues.some((issue) => issue.path === "liveFrom"))
    }
    assert.equal(env.store.plans.size, 0)
    assert.deepEqual(env.messages.requests, [])
})

test("a live threshold above the server's slots is refused", async () => {
    const env = setup()
    env.players.set(
        SEED_TEST_SERVER,
        seedReading(12, NOW.getTime(), { capacity: 98 })
    )
    assert.deepEqual(
        await save(env, {
            settings: boardSeedSettings({ liveFrom: 99 }),
        }),
        {
            kind: "invalid",
            issues: [{ path: "liveFrom", code: "live_above_capacity" }],
        }
    )
})

test("a server outside the clan cannot get a plan", async () => {
    const env = setup()
    env.players.set(SEED_TEST_SERVER, null)
    assert.deepEqual(await save(env), { kind: "not_found" })
    assert.equal(env.store.plans.size, 0)
})
