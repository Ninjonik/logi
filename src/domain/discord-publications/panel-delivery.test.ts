import assert from "node:assert/strict"
import test from "node:test"

import {
    BOT_HEARTBEAT_INTERVAL_MS,
    BOT_HEARTBEAT_MIN_WRITE_MS,
    BOT_OFFLINE_AFTER_MS,
    MINIMUM_BOT_VERSION,
    REQUIRED_PANEL_PROTOCOL,
    botHeartbeatNeedsWrite,
    botHeartbeatState,
    botVisitedGuild,
    isRequestPending,
    nextPanelStatus,
    PANEL_STATUS_REFRESH_MS,
    panelActionPatch,
    panelStatusNeedsWrite,
    panelDeliveryState,
    panelMessageState,
    panelWork,
    type PanelAttempt,
    type PanelDeliveryInput,
} from "./panel-delivery"
import {
    botHeartbeatSchema,
    panelAttemptSchema,
    panelErrorSchema,
} from "./panel-delivery.schema"

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
    assert.deepEqual(botHeartbeatState({ ...beat, protocol: 1 }, 2_000), {
        state: "outdated",
        version: "1.0.268",
        protocol: 1,
        seenAt: 1_000,
        requiredProtocol: REQUIRED_PANEL_PROTOCOL,
        requiredVersion: MINIMUM_BOT_VERSION,
    })
    assert.equal(
        botHeartbeatSchema.safeParse({
            version: "1.0.268; rm -rf",
            protocol: 2,
            startedAt: 0,
        }).success,
        false
    )
})

test("the last error stays after a success, with the first success after it (P2-32)", () => {
    const failed = nextPanelStatus(
        null,
        attempt({
            ok: false,
            attemptAt: 1_000,
            error: { code: "discord_unavailable", at: 1_000 },
            channelPrivate: true,
        })
    )
    assert.equal(failed.lastError?.code, "discord_unavailable")
    assert.equal(failed.recoveredAt, null)
    assert.equal(failed.channelPrivate, true)
    const recovered = nextPanelStatus(failed, attempt({ attemptAt: 61_000 }))
    assert.equal(recovered.error, null)
    assert.equal(recovered.lastError?.code, "discord_unavailable")
    assert.equal(recovered.recoveredAt, 61_000)
    // A pass that did not look at the channel keeps its last known privacy.
    assert.equal(recovered.channelPrivate, true)
    const later = nextPanelStatus(recovered, attempt({ attemptAt: 121_000 }))
    assert.equal(later.recoveredAt, 61_000)
    assert.equal(
        nextPanelStatus(
            later,
            attempt({ attemptAt: 181_000, channelPrivate: false })
        ).channelPrivate,
        false
    )
})

test("each message of a panel reads its own state from its publication (P1-20, P1-21)", () => {
    const delivered = {
        channelId: "1",
        messageId: "2",
        pending: false,
        error: null,
        lastSuccessAt: 5_000,
    }
    const state = (input: Partial<Parameters<typeof panelMessageState>[0]>) =>
        panelMessageState({
            panel: "published",
            requestedAt: null,
            errorAt: null,
            publication: delivered,
            ...input,
        })
    assert.equal(state({}), "published")
    // A paused or unsent panel holds every message.
    assert.equal(state({ panel: "paused" }), "paused")
    assert.equal(state({ panel: "unsent", publication: null }), "unsent")
    // Its own failed delivery, also an unconfirmed create.
    assert.equal(
        state({
            publication: { ...delivered, error: "Panel se neaktualizoval." },
        }),
        "error"
    )
    // Not posted yet: waiting, or failing with the panel.
    assert.equal(state({ panel: "waiting", publication: null }), "waiting")
    assert.equal(
        state({ panel: "error", errorAt: 6_000, publication: null }),
        "error"
    )
    // A request: confirmed after it is published, before it waits.
    assert.equal(state({ panel: "waiting", requestedAt: 4_000 }), "published")
    assert.equal(state({ panel: "waiting", requestedAt: 6_000 }), "waiting")
    // The panel's error: a message confirmed after it is fine.
    assert.equal(state({ panel: "error", errorAt: 4_000 }), "published")
    assert.equal(state({ panel: "error", errorAt: 6_000 }), "error")
    assert.equal(state({ panel: "error", errorAt: null }), "published")
})

test("a pass that only moves the times is not stored; a change or ten minutes are", () => {
    const first = nextPanelStatus(null, attempt({ attemptAt: 1_000 }))
    assert.equal(panelStatusNeedsWrite(null, first), true)
    // The next minutes render the same panel: nothing to store.
    for (let minute = 1; minute < 10; minute++)
        assert.equal(
            panelStatusNeedsWrite(
                first,
                nextPanelStatus(
                    first,
                    attempt({
                        attemptAt: 1_000 + minute * 60_000,
                        nextAt: 61_000 + minute * 60_000,
                        dataAt: 900 + minute * 60_000,
                    })
                )
            ),
            false
        )
    assert.equal(
        panelStatusNeedsWrite(
            first,
            nextPanelStatus(
                first,
                attempt({ attemptAt: 1_000 + PANEL_STATUS_REFRESH_MS })
            )
        ),
        true
    )
    for (const change of [
        { warnings: ["attach_files_missing" as const] },
        { messages: 2 },
        { handledRequestAt: 900 },
        { channelPrivate: true },
        { nextAt: null },
    ])
        assert.equal(
            panelStatusNeedsWrite(
                first,
                nextPanelStatus(
                    first,
                    attempt({ attemptAt: 61_000, ...change })
                )
            ),
            true,
            JSON.stringify(change)
        )
})

test("a repeated error is stored once, a different one at once, and again after ten minutes", () => {
    const ok = nextPanelStatus(null, attempt({ attemptAt: 1_000 }))
    const failing = (at: number, code: "channel_missing" | "unknown") =>
        attempt({ attemptAt: at, ok: false, error: { code, at } })
    const failed = nextPanelStatus(ok, failing(61_000, "channel_missing"))
    assert.equal(panelStatusNeedsWrite(ok, failed), true)
    const again = nextPanelStatus(failed, failing(91_000, "channel_missing"))
    assert.equal(panelStatusNeedsWrite(failed, again), false)
    assert.equal(
        panelStatusNeedsWrite(
            failed,
            nextPanelStatus(failed, failing(91_000, "unknown"))
        ),
        true
    )
    assert.equal(
        panelStatusNeedsWrite(
            failed,
            nextPanelStatus(
                failed,
                failing(61_000 + PANEL_STATUS_REFRESH_MS, "channel_missing")
            )
        ),
        true
    )
    // The first success after it records the recovery.
    assert.equal(
        panelStatusNeedsWrite(
            failed,
            nextPanelStatus(failed, attempt({ attemptAt: 121_000 }))
        ),
        true
    )
})

test("a late heartbeat stays under the offline threshold, and a repeated beat is stored once a minute", () => {
    // The worker ticks every 15 s, so a beat can come that much late.
    assert.ok(BOT_HEARTBEAT_INTERVAL_MS + 15_000 < BOT_OFFLINE_AFTER_MS)
    const beat = { version: "1.2.0", protocol: 2, startedAt: 5 }
    const stored = { ...beat, seenAt: 1_000, guildIds: ["2", "1"] }
    assert.equal(
        botHeartbeatNeedsWrite(null, { ...beat, guildIds: [] }, 1_000),
        true
    )
    // A row from before the list is rewritten with it.
    assert.equal(
        botHeartbeatNeedsWrite(
            { ...beat, seenAt: 1_000 },
            { ...beat, guildIds: ["1"] },
            2_000
        ),
        true
    )
    const next = { ...beat, guildIds: ["1", "2"] }
    assert.equal(botHeartbeatNeedsWrite(stored, next, 31_000), false)
    assert.equal(
        botHeartbeatNeedsWrite(
            stored,
            next,
            1_000 + BOT_HEARTBEAT_MIN_WRITE_MS
        ),
        true
    )
    for (const change of [
        { version: "1.2.1" },
        { startedAt: 6 },
        { guildIds: ["1"] },
    ])
        assert.equal(
            botHeartbeatNeedsWrite(stored, { ...next, ...change }, 31_000),
            true,
            JSON.stringify(change)
        )
})

test("presence in a workspace comes from the bot row's list, or its own row before the list", () => {
    const bot = { version: "1.2.0", protocol: 2, startedAt: 0, seenAt: 1_000 }
    const listed = { ...bot, guildIds: ["1"] }
    assert.equal(botVisitedGuild(listed, null, "1", 2_000), true)
    assert.equal(botVisitedGuild(listed, null, "2", 2_000), false)
    assert.equal(
        botVisitedGuild(listed, null, "1", 1_000 + BOT_OFFLINE_AFTER_MS),
        false
    )
    // A list wins over a leftover per-workspace row.
    assert.equal(botVisitedGuild(listed, { seenAt: 1_500 }, "2", 2_000), false)
    assert.equal(botVisitedGuild(bot, { seenAt: 1_500 }, "2", 2_000), true)
    assert.equal(botVisitedGuild(bot, null, "2", 2_000), false)
    assert.equal(botVisitedGuild(null, null, "2", 2_000), false)
})
