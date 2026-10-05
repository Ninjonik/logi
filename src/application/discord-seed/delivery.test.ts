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
    PublicationNotSent,
    type Publication,
    type PublicationStore,
} from "@/application/discord-publications/publish"

import {
    deliverSeedCall,
    recordSeedCallPosted,
    reportSeedCallFailed,
    seedCallTarget,
    type SeedCallDiscordPort,
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

function discord(messageExists = false) {
    const calls: string[] = []
    const port: SeedCallDiscordPort = {
        exists: async () => messageExists,
        recover: async () => null,
        create: async (channel) => {
            calls.push(`create:${channel}`)
            return "message-1"
        },
        edit: async (channel, id) => {
            calls.push(`edit:${channel}:${id}`)
        },
        remove: async (channel, id) => {
            calls.push(`remove:${channel}:${id}`)
        },
        roleMemberCount: async (roleId) => {
            calls.push(`count:${roleId}`)
            return 34
        },
    }
    return { port, calls }
}
function publications(initial: Partial<Publication> = {}) {
    let state: Publication = {
        id: "seed-call",
        fence: 1,
        channelId: null,
        messageId: null,
        pending: null,
        hash: null,
        ...initial,
    }
    const store: PublicationStore = {
        claim: async () => structuredClone(state),
        save: async (next) => {
            state = structuredClone(next)
        },
        finish: async () => {},
    }
    return { store, current: () => state }
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
    const transport = discord()
    const recorded = reports()
    const result = await deliverSeedCall(
        { run, hasMessage: false, hash: "h1" },
        {
            store: publications().store,
            discord: transport.port,
            reports: recorded.reports,
        }
    )
    assert.deepEqual(result, { kind: "delivered", messageId: "message-1" })
    assert.deepEqual(transport.calls, [
        `create:${SEED_TEST_CHANNEL}`,
        `count:${SEED_TEST_ROLE}`,
    ])
    assert.deepEqual(recorded.calls, [
        { posted: { runId: run.id, pingedMembers: 34 } },
    ])
})

test("a silent call reports no members and later edits report nothing", async () => {
    const { run } = await startedRun(boardSeedSettings({ seedRoleId: null }))
    const transport = discord()
    const recorded = reports()
    await deliverSeedCall(
        { run, hasMessage: false, hash: "h1" },
        {
            store: publications().store,
            discord: transport.port,
            reports: recorded.reports,
        }
    )
    assert.deepEqual(recorded.calls, [
        { posted: { runId: run.id, pingedMembers: null } },
    ])
    const posted: StoredSeedRun = { ...run, callPostedAt: NOW.getTime() }
    const edit = discord(true)
    const again = reports()
    await deliverSeedCall(
        { run: posted, hasMessage: true, hash: "h2" },
        {
            store: publications({
                channelId: SEED_TEST_CHANNEL,
                messageId: "message-1",
                hash: "h1",
            }).store,
            discord: edit.port,
            reports: again.reports,
        }
    )
    assert.deepEqual(edit.calls, [`edit:${SEED_TEST_CHANNEL}:message-1`])
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
    const transport = discord(true)
    const result = await deliverSeedCall(
        { run: live, hasMessage: true, hash: "h" },
        {
            store: publications({
                channelId: SEED_TEST_CHANNEL,
                messageId: "message-1",
                hash: "h0",
            }).store,
            discord: transport.port,
            reports: reports().reports,
        }
    )
    assert.deepEqual(result, { kind: "delivered", messageId: null })
    assert.deepEqual(transport.calls, [`remove:${SEED_TEST_CHANNEL}:message-1`])
})

test("an ended seed without a call is skipped, never posted late", async () => {
    const { run } = await startedRun()
    const transport = discord()
    assert.deepEqual(
        await deliverSeedCall(
            { run: { ...run, status: "failed" }, hasMessage: false, hash: "h" },
            {
                store: publications().store,
                discord: transport.port,
                reports: reports().reports,
            }
        ),
        { kind: "skipped" }
    )
    assert.deepEqual(transport.calls, [])
})

test("a call Discord refuses fails the run; other errors leave it to retry", async () => {
    const { run } = await startedRun()
    const refusing = discord()
    refusing.port.create = async () => {
        throw new PublicationNotSent("Missing Permissions")
    }
    const recorded = reports()
    await assert.rejects(
        deliverSeedCall(
            { run, hasMessage: false, hash: "h" },
            {
                store: publications().store,
                discord: refusing.port,
                reports: recorded.reports,
            }
        ),
        PublicationNotSent
    )
    assert.deepEqual(recorded.calls, [
        { failed: { runId: run.id, reason: "channel_unavailable" } },
    ])
    const flaky = discord()
    flaky.port.create = async () => {
        throw new Error("socket hang up")
    }
    const untouched = reports()
    await assert.rejects(
        deliverSeedCall(
            { run, hasMessage: false, hash: "h" },
            {
                store: publications().store,
                discord: flaky.port,
                reports: untouched.reports,
            }
        )
    )
    assert.deepEqual(untouched.calls, [])
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
