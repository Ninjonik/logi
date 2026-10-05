import assert from "node:assert/strict"
import test from "node:test"

import {
    SEED_TEST_CHANNEL,
    SEED_TEST_ROLE,
    SEED_TEST_SERVER,
    boardSeedSettings,
    createSeedTestPorts,
    seedReading,
} from "@/infrastructure/testing/in-memory-seed"

import {
    deliverSeedCall,
    recordSeedCallPosted,
    reportSeedCallFailed,
    seedCallTarget,
    type SeedCallPublisher,
} from "./delivery"
import { startSeedManually } from "./start-seed"
import type { StoredSeedRun } from "./ports"

const NOW = new Date("2026-10-10T15:40:00Z")
const admin = { id: "100000000000000001", name: "Kowalski" }

async function startedRun(settings = boardSeedSettings()) {
    const env = createSeedTestPorts(NOW)
    env.store.addPlan(SEED_TEST_SERVER, settings)
    env.players.set(SEED_TEST_SERVER, seedReading(12, NOW.getTime()))
    const result = await startSeedManually(env.ports, {
        server: SEED_TEST_SERVER,
        actor: admin,
        via: "discord",
        channelId: null,
        requestKey: "click",
    })
    if (result.kind !== "started") throw new Error(result.kind)
    return { env, run: result.run }
}

class Permanent extends Error {}

function discord(answer: () => Promise<string | null | undefined>) {
    const calls: string[] = []
    const port: SeedCallPublisher = {
        publish: async (channelId) => {
            calls.push(`publish:${channelId}`)
            return answer()
        },
        isPermanentFailure: (error) => error instanceof Permanent,
        roleMemberCount: async (roleId) => {
            calls.push(`count:${roleId}`)
            return 34
        },
    }
    return { port, calls }
}
function reports() {
    const calls: unknown[] = []
    return {
        calls,
        reports: {
            posted: async (input: unknown) => {
                calls.push({ posted: input })
            },
            failed: async (input: unknown) => {
                calls.push({ failed: input })
            },
        },
    }
}

test("the call goes to the run's channel while seeding and only edits after the end", () => {
    const run = {
        channelId: SEED_TEST_CHANNEL,
        endAction: "edit" as const,
    }
    assert.deepEqual(seedCallTarget({ ...run, status: "seeding" }, false), {
        action: "show",
        channelId: SEED_TEST_CHANNEL,
    })
    for (const status of [
        "live",
        "ended_timeout",
        "ended_admin",
        "failed",
    ] as const) {
        assert.deepEqual(seedCallTarget({ ...run, status }, true), {
            action: "show",
            channelId: SEED_TEST_CHANNEL,
        })
        assert.deepEqual(
            seedCallTarget({ ...run, status }, false),
            { action: "none" },
            `${status}: an ended seed never posts late`
        )
    }
    assert.deepEqual(
        seedCallTarget({ ...run, status: "live", endAction: "delete" }, true),
        { action: "remove" }
    )
    assert.deepEqual(
        seedCallTarget(
            { ...run, status: "ended_timeout", endAction: "delete" },
            true
        ),
        { action: "show", channelId: SEED_TEST_CHANNEL },
        "only reaching the threshold deletes"
    )
})

test("the first post reports the pinged role members once", async () => {
    const { run } = await startedRun()
    const transport = discord(async () => "message-1")
    const recorded = reports()
    const result = await deliverSeedCall(
        { run, hasMessage: false },
        { discord: transport.port, reports: recorded.reports }
    )
    assert.deepEqual(result, { kind: "delivered", messageId: "message-1" })
    assert.deepEqual(transport.calls, [
        `publish:${SEED_TEST_CHANNEL}`,
        `count:${SEED_TEST_ROLE}`,
    ])
    assert.deepEqual(recorded.calls, [
        { posted: { runId: run.id, pingedMembers: 34 } },
    ])
})

test("a silent call reports no members and later edits report nothing", async () => {
    const { run } = await startedRun(boardSeedSettings({ seedRoleId: null }))
    const transport = discord(async () => "message-1")
    const recorded = reports()
    await deliverSeedCall(
        { run, hasMessage: false },
        { discord: transport.port, reports: recorded.reports }
    )
    assert.deepEqual(recorded.calls, [
        { posted: { runId: run.id, pingedMembers: null } },
    ])
    assert.equal(
        transport.calls.some((call) => call.startsWith("count:")),
        false
    )
    const posted: StoredSeedRun = { ...run, callPostedAt: NOW.getTime() }
    const again = reports()
    await deliverSeedCall(
        { run: posted, hasMessage: true },
        {
            discord: discord(async () => "message-1").port,
            reports: again.reports,
        }
    )
    assert.deepEqual(again.calls, [])
})

test("reaching the threshold with 'Smazat zprávu' deletes the call", async () => {
    const { run } = await startedRun(boardSeedSettings({ endAction: "delete" }))
    const live: StoredSeedRun = {
        ...run,
        status: "live",
        endedAt: NOW.getTime(),
        callPostedAt: NOW.getTime(),
    }
    const transport = discord(async () => null)
    const result = await deliverSeedCall(
        { run: live, hasMessage: true },
        { discord: transport.port, reports: reports().reports }
    )
    assert.deepEqual(result, { kind: "delivered", messageId: null })
    assert.deepEqual(transport.calls, ["publish:null"])
})

test("an ended seed without a call is skipped, never posted late; a busy lease skips", async () => {
    const { run } = await startedRun()
    const transport = discord(async () => "late")
    assert.deepEqual(
        await deliverSeedCall(
            { run: { ...run, status: "failed" }, hasMessage: false },
            { discord: transport.port, reports: reports().reports }
        ),
        { kind: "skipped" }
    )
    assert.deepEqual(transport.calls, [])
    const busy = reports()
    assert.deepEqual(
        await deliverSeedCall(
            { run, hasMessage: false },
            {
                discord: discord(async () => undefined).port,
                reports: busy.reports,
            }
        ),
        { kind: "skipped" }
    )
    assert.deepEqual(busy.calls, [])
})

test("a call Discord refuses for good fails the run; other errors leave it to retry", async () => {
    const { run } = await startedRun()
    const recorded = reports()
    await assert.rejects(
        deliverSeedCall(
            { run, hasMessage: false },
            {
                discord: discord(async () => {
                    throw new Permanent("Missing Permissions")
                }).port,
                reports: recorded.reports,
            }
        ),
        Permanent
    )
    assert.deepEqual(recorded.calls, [
        { failed: { runId: run.id, reason: "channel_unavailable" } },
    ])
    const untouched = reports()
    await assert.rejects(
        deliverSeedCall(
            { run, hasMessage: false },
            {
                discord: discord(async () => {
                    throw new Error("socket hang up")
                }).port,
                reports: untouched.reports,
            }
        )
    )
    assert.deepEqual(untouched.calls, [])
    const existing = reports()
    await assert.rejects(
        deliverSeedCall(
            { run, hasMessage: true },
            {
                discord: discord(async () => {
                    throw new Permanent("Missing Permissions")
                }).port,
                reports: existing.reports,
            }
        )
    )
    assert.deepEqual(
        existing.calls,
        [],
        "a posted call that cannot be edited does not end the seed"
    )
})

test("the bot's reports update the run once and stay inside the clan", async () => {
    const { env, run } = await startedRun()
    assert.deepEqual(
        await recordSeedCallPosted(env.ports, {
            guildId: "999999999999999999",
            runId: run.id,
            pingedMembers: 34,
        }),
        { kind: "not_found" }
    )
    const recorded = await recordSeedCallPosted(env.ports, {
        guildId: SEED_TEST_SERVER.guildId,
        runId: run.id,
        pingedMembers: 34,
    })
    assert.equal(recorded.kind, "recorded")
    assert.equal((await env.store.run(run.id))?.pingedMembers, 34)
    assert.deepEqual(
        await recordSeedCallPosted(env.ports, {
            guildId: SEED_TEST_SERVER.guildId,
            runId: run.id,
            pingedMembers: 1,
        }),
        { kind: "unchanged" }
    )
})

test("a reported delivery failure fails the run and frees the server", async () => {
    const { env, run } = await startedRun()
    env.messages.requests = []
    const result = await reportSeedCallFailed(env.ports, {
        guildId: SEED_TEST_SERVER.guildId,
        runId: run.id,
        reason: "channel_unavailable",
    })
    assert.equal(result.kind, "recorded")
    assert.equal((await env.store.run(run.id))?.status, "failed")
    assert.equal(
        (await env.store.plan(SEED_TEST_SERVER))?.state.activeRunId,
        null
    )
    assert.deepEqual(env.messages.requests, [
        { kind: "control", connectionId: SEED_TEST_SERVER.connectionId },
    ])
    assert.deepEqual(
        await reportSeedCallFailed(env.ports, {
            guildId: SEED_TEST_SERVER.guildId,
            runId: run.id,
            reason: "channel_unavailable",
        }),
        { kind: "unchanged" }
    )
})
