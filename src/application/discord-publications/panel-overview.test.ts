import assert from "node:assert/strict"
import test from "node:test"

import {
    buildPanelOverview,
    type StoredPanel,
    type StoredPublication,
} from "./panel-overview"
import type { PanelStatusRecord } from "@/domain/discord-publications/panel-delivery"

const now = 100_000
const panel = (overrides: Partial<StoredPanel> = {}): StoredPanel => ({
    id: "p1",
    kind: "server",
    gameId: "hell_let_loose",
    channelId: "123456789012345678",
    connectionId: "hll-1",
    enabled: true,
    showPlayers: true,
    artwork: true,
    revision: 3,
    createdAt: 1_000,
    ...overrides,
})
const publication = (
    overrides: Partial<StoredPublication> = {}
): StoredPublication => ({
    key: "panel:p1",
    channelId: "123456789012345678",
    messageId: "223456789012345678",
    pending: false,
    lastSuccessAt: 90_000,
    retryAt: 0,
    error: null,
    ...overrides,
})
const status = (
    overrides: Partial<PanelStatusRecord> = {}
): PanelStatusRecord => ({
    claimedAt: 80_000,
    attemptAt: 90_000,
    successAt: 90_000,
    nextAt: 150_000,
    dataAt: 89_000,
    handledRequestAt: null,
    error: null,
    warnings: [],
    messages: 1,
    sentAt: 80_000,
    ...overrides,
})

const overview = (
    panels: Parameters<typeof buildPanelOverview>[0]["panels"],
    heartbeat: Parameters<typeof buildPanelOverview>[0]["heartbeat"] = null
) =>
    buildPanelOverview({
        now,
        heartbeat,
        defaultStyle: "a",
        panels,
        sources: [],
        servers: [],
    })

test("a published panel has its timeline, message link, style and editor settings", () => {
    const result = overview([
        { panel: panel(), status: status(), publications: [publication()] },
    ])
    const item = result.panels[0]!
    assert.equal(item.state, "published")
    assert.deepEqual(item.message, {
        channelId: "123456789012345678",
        messageId: "223456789012345678",
    })
    assert.equal(item.timeline.sentAt, 80_000)
    assert.equal(item.timeline.nextUpdateAt, 150_000)
    assert.equal(item.style, "a")
    assert.equal(item.settings.content.password, false)
    assert.equal(item.settings.connectionId, "hll-1")
    assert.equal(result.counts.published, 1)
})

test("legacy scoreboard rows and disabled rows read as server and paused", () => {
    const result = overview([
        {
            panel: panel({ kind: "scoreboard", enabled: false }),
            status: status(),
            publications: [publication()],
        },
        {
            panel: panel({ id: "x", kind: "seed" }),
            status: null,
            publications: [],
        },
    ])
    assert.equal(result.panels.length, 1)
    assert.equal(result.panels[0]?.kind, "server")
    assert.equal(result.panels[0]?.state, "paused")
    assert.equal(result.counts.paused, 1)
})

test("an unconfirmed create is an error with delivery_uncertain until retried", () => {
    const result = overview([
        {
            panel: panel(),
            status: null,
            publications: [
                publication({
                    messageId: null,
                    pending: true,
                    error: "Discord did not confirm",
                }),
            ],
        },
    ])
    const item = result.panels[0]!
    assert.equal(item.state, "error")
    assert.equal(item.uncertain, true)
    assert.equal(item.error?.code, "delivery_uncertain")
    assert.equal(item.message, null)
})

test("a newly saved panel reads Neodesláno; after Odeslat do kanálu it waits for the bot", () => {
    const result = overview([
        {
            panel: panel({ draft: true, savedAt: 50_000, savedBy: "u" }),
            status: null,
            publications: [],
        },
        {
            panel: panel({
                id: "p2",
                requestedAt: 95_000,
                requestKind: "publish",
            }),
            status: null,
            publications: [],
        },
    ])
    assert.deepEqual(
        result.panels.map((item) => item.state),
        ["unsent", "waiting"]
    )
    assert.equal(result.panels[0]?.timeline.savedAt, 50_000)
    assert.equal(result.counts.unsent, 1)
    assert.equal(result.counts.waiting, 1)
})

test("the bot heartbeat is part of the overview", () => {
    const result = overview([], {
        version: "1.0.268",
        protocol: 2,
        startedAt: 0,
        seenAt: now - 5_000,
    })
    assert.equal(result.bot.state, "online")
})

test("the overview never carries a password or a key", () => {
    const result = buildPanelOverview({
        now,
        heartbeat: null,
        defaultStyle: "b",
        panels: [
            { panel: panel(), status: status(), publications: [publication()] },
        ],
        sources: [],
        servers: [
            {
                connectionId: "hll-1",
                slug: "vlci-1",
                joinUrl: "https://logi.app/join/vlci-1",
                address: "203.0.113.24:7777",
                joinCode: null,
                hasPassword: true,
            },
        ],
    })
    const text = JSON.stringify(result)
    assert.doesNotMatch(text, /envelope|ciphertext|secret/i)
})

test("the overview lists seed control messages, names and the editor's flags (P1-18, P1-22, P2-05)", () => {
    const result = buildPanelOverview({
        now,
        heartbeat: null,
        defaultStyle: "a",
        panels: [
            {
                panel: panel({ pausedBy: "u1", draft: false }),
                status: status({
                    channelPrivate: true,
                    lastError: { code: "discord_unavailable", at: 70_000 },
                    recoveredAt: 71_000,
                }),
                publications: [publication()],
            },
            {
                panel: panel({ id: "p2", draft: true }),
                status: null,
                publications: [],
            },
        ],
        sources: [],
        servers: [],
        controls: [
            {
                connectionId: "hll-1",
                channelId: "323456789012345678",
                message: {
                    channelId: "323456789012345678",
                    messageId: "423456789012345678",
                    revision: 3,
                    deliveredRevision: 3,
                    lastSuccessAt: 95_000,
                    error: null,
                    pending: false,
                },
            },
            {
                connectionId: "hll-2",
                channelId: "323456789012345679",
                message: {
                    channelId: null,
                    messageId: null,
                    revision: 1,
                    deliveredRevision: 0,
                    lastSuccessAt: null,
                    error: null,
                    pending: false,
                },
            },
            { connectionId: "wd-1", channelId: null, message: null },
        ],
        people: { u1: "Hráč 01" },
    })
    const [sent, draft] = result.panels
    assert.equal(sent!.sent, true)
    assert.equal(sent!.channelPrivate, true)
    assert.equal(sent!.lastError?.code, "discord_unavailable")
    assert.equal(sent!.recoveredAt, 71_000)
    assert.equal(draft!.sent, false)
    assert.equal(draft!.channelPrivate, null)
    assert.deepEqual(result.people, { u1: "Hráč 01" })
    assert.deepEqual(
        result.controls.map((control) => [control.connectionId, control.state]),
        [
            ["hll-1", "published"],
            ["hll-2", "waiting"],
        ]
    )
    assert.deepEqual(result.controls[0]!.message, {
        channelId: "323456789012345678",
        messageId: "423456789012345678",
    })
})
