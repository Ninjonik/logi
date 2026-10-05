import assert from "node:assert/strict"
import test from "node:test"

import {
    BOT_OFFLINE_AFTER_MS,
    botHeartbeatSchema,
    botHeartbeatState,
    isRequestPending,
    nextPanelStatus,
    panelActionPatch,
    panelAttemptSchema,
    panelDeliveryState,
    panelErrorSchema,
    panelWork,
    type PanelAttempt,
    type PanelDeliveryInput,
} from "./panel-delivery"

const attempt = (overrides: Partial<PanelAttempt> = {}): PanelAttempt => ({
    attemptAt: 1_000,
    ok: true,
    error: null,
    nextAt: 61_000,
    dataAt: 900,
    handledRequestAt: null,
    warnings: [],
    messages: 1,
    ...overrides,
})

test("an attempt folds into the stored status; the first confirmed message sets sentAt", () => {
    const failed = nextPanelStatus(
        null,
        attempt({
            ok: false,
            messages: 0,
            error: {
                code: "missing_permissions",
                at: 1_000,
                permissions: ["embed_links"],
            },
            handledRequestAt: 500,
        })
    )
    assert.equal(failed.successAt, null)
    assert.equal(failed.sentAt, null)
    assert.equal(failed.claimedAt, 1_000)
    assert.equal(failed.error?.code, "missing_permissions")

    const sent = nextPanelStatus(
        failed,
        attempt({ attemptAt: 2_000, handledRequestAt: 500, dataAt: null })
    )
    assert.equal(sent.error, null)
    assert.equal(sent.successAt, 2_000)
    assert.equal(sent.sentAt, 2_000)
    // The same request is not claimed twice; data time is kept when absent.
    assert.equal(sent.claimedAt, 1_000)
    assert.equal(sent.dataAt, 900)

    const later = nextPanelStatus(sent, attempt({ attemptAt: 3_000 }))
    assert.equal(later.sentAt, 2_000)
    assert.equal(later.handledRequestAt, 500)
})

test("attempt and error schemas reject internal text and unknown codes", () => {
    assert.equal(
        panelErrorSchema.safeParse({ code: "boom", at: 1 }).success,
        false
    )
    assert.equal(
        panelErrorSchema.safeParse({
            code: "unknown",
            at: 1,
            category: "Error: secret token xyz",
        }).success,
        false
    )
    assert.equal(
        panelAttemptSchema.safeParse({ ...attempt(), detail: "stack" }).success,
        false
    )
    assert.equal(panelAttemptSchema.safeParse(attempt()).success, true)
})

const base: PanelDeliveryInput = {
    draft: false,
    paused: false,
    removing: false,
    requestedAt: null,
    status: null,
    messages: 0,
    uncertain: false,
}

test("every panel has a state chip, also before the bot's first pass", () => {
    assert.equal(panelDeliveryState({ ...base, draft: true }), "unsent")
    assert.equal(panelDeliveryState(base), "waiting")
    assert.equal(panelDeliveryState({ ...base, paused: true }), "paused")
    assert.equal(panelDeliveryState({ ...base, removing: true }), "waiting")
    assert.equal(
        panelDeliveryState({
            ...base,
            messages: 1,
            status: {
                attemptAt: 10,
                successAt: 10,
                handledRequestAt: null,
                error: null,
            },
        }),
        "published"
    )
})

test("an unanswered request reads Čeká na bota; a newer error reads Chyba", () => {
    const status = {
        attemptAt: 10,
        successAt: 10,
        handledRequestAt: 5,
        error: null,
    }
    assert.equal(
        panelDeliveryState({ ...base, messages: 1, status, requestedAt: 20 }),
        "waiting"
    )
    assert.equal(
        panelDeliveryState({ ...base, messages: 1, status, requestedAt: 5 }),
        "published"
    )
    assert.equal(
        panelDeliveryState({
            ...base,
            status: {
                ...status,
                attemptAt: 30,
                error: { code: "channel_missing", at: 30 },
            },
        }),
        "error"
    )
    // An older error followed by a success is published again.
    assert.equal(
        panelDeliveryState({
            ...base,
            messages: 1,
            status: {
                ...status,
                successAt: 40,
                error: { code: "channel_missing", at: 30 },
            },
        }),
        "published"
    )
    assert.equal(panelDeliveryState({ ...base, uncertain: true }), "error")
    assert.equal(isRequestPending(10, null), true)
    assert.equal(isRequestPending(10, 10), false)
    assert.equal(isRequestPending(null, null), false)
})

const panel = { draft: false, paused: false, removing: false }
const at = { now: 5_000, actorId: "100000000000000001" }

test("Odeslat do kanálu posts a draft and resumes a paused panel", () => {
    const decision = panelActionPatch({ ...panel, draft: true }, "publish", at)
    assert.deepEqual(decision, {
        ok: true,
        patch: {
            requestedAt: 5_000,
            requestKind: "publish",
            draft: false,
            paused: false,
            enabled: true,
            pausedAt: null,
            pausedBy: null,
        },
        resetRetry: true,
        abandonPending: false,
    })
})

test("pause records who and when; resume clears it and retries at once", () => {
    const paused = panelActionPatch(panel, "pause", at)
    assert.ok(paused.ok)
    assert.equal(paused.patch.paused, true)
    assert.equal(paused.patch.pausedBy, at.actorId)
    assert.equal(paused.patch.pausedAt, at.now)
    assert.equal(paused.resetRetry, false)
    const resumed = panelActionPatch({ ...panel, paused: true }, "resume", at)
    assert.ok(resumed.ok)
    assert.equal(resumed.patch.paused, false)
    assert.equal(resumed.patch.pausedBy, null)
    assert.equal(resumed.resetRetry, true)
})

test("retry forgets an unconfirmed create; delete returns the panel to unsent", () => {
    const retry = panelActionPatch(panel, "retry", at)
    assert.ok(retry.ok)
    assert.equal(retry.abandonPending, true)
    const removed = panelActionPatch(panel, "delete", at)
    assert.ok(removed.ok)
    assert.equal(removed.patch.draft, true)
    const gone = panelActionPatch(panel, "remove", at)
    assert.ok(gone.ok)
    assert.equal(gone.patch.removing, true)
})

test("actions on an unsent or removing panel are refused with a reason", () => {
    for (const action of [
        "refresh",
        "pause",
        "resume",
        "retry",
        "delete",
    ] as const)
        assert.deepEqual(
            panelActionPatch({ ...panel, draft: true }, action, at),
            { ok: false, reason: "not_sent" }
        )
    assert.deepEqual(
        panelActionPatch({ ...panel, removing: true }, "publish", at),
        { ok: false, reason: "removing" }
    )
})

test("the worker draws a paused panel once, then only on a request", () => {
    const work = (overrides: Partial<Parameters<typeof panelWork>[0]>) =>
        panelWork({
            draft: false,
            paused: false,
            removing: false,
            requestPending: false,
            pausedDrawn: false,
            ...overrides,
        })
    assert.equal(work({}), "render")
    assert.equal(work({ draft: true }), "withdraw")
    assert.equal(work({ removing: true, draft: true }), "remove_panel")
    assert.equal(work({ paused: true }), "render_paused")
    assert.equal(work({ paused: true, pausedDrawn: true }), "skip")
    assert.equal(
        work({ paused: true, pausedDrawn: true, requestPending: true }),
        "render_paused"
    )
})

test("the heartbeat reads online, offline after three minutes, or outdated", () => {
    const beat = {
        version: "1.0.268",
        protocol: 2,
        startedAt: 0,
        seenAt: 1_000,
    }
    assert.deepEqual(botHeartbeatState(null, 0), { state: "unknown" })
    assert.equal(botHeartbeatState(beat, 2_000).state, "online")
    assert.equal(
        botHeartbeatState(beat, 1_000 + BOT_OFFLINE_AFTER_MS + 1).state,
        "offline"
    )
    assert.equal(
        botHeartbeatState({ ...beat, protocol: 1 }, 2_000).state,
        "outdated"
    )
    assert.equal(
        botHeartbeatSchema.safeParse({
            version: "1.0.268; rm -rf",
            protocol: 2,
            startedAt: 0,
        }).success,
        false
    )
})
