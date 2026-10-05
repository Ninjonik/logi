import assert from "node:assert/strict"
import test from "node:test"

import {
    DEFAULT_PANEL_CONTENT,
    isPanelPaused,
    normalizePanelKind,
    panelSaveSchema,
    resolvePanelContent,
} from "./settings"

const channelId = "123456789012345678"

test("old scoreboard rows read as the one live server kind", () => {
    assert.equal(normalizePanelKind("scoreboard"), "server")
    assert.equal(normalizePanelKind("server"), "server")
    assert.equal(normalizePanelKind("league"), "league")
    assert.equal(normalizePanelKind("seed"), null)
})

test("paused is the real flag; rows from before it read their old switch", () => {
    assert.equal(isPanelPaused({ enabled: true }), false)
    assert.equal(isPanelPaused({ enabled: false }), true)
    assert.equal(isPanelPaused({ enabled: true, paused: true }), true)
    assert.equal(isPanelPaused({ enabled: false, paused: false }), false)
})

test("content defaults keep the password off", () => {
    assert.deepEqual(resolvePanelContent(undefined), DEFAULT_PANEL_CONTENT)
    assert.equal(DEFAULT_PANEL_CONTENT.password, false)
    assert.equal(resolvePanelContent({ queue: false }).queue, false)
})

test("each kind needs its own source", () => {
    const parse = (value: Record<string, unknown>) =>
        panelSaveSchema.safeParse({ channelId, ...value })
    assert.equal(parse({ kind: "server" }).success, false)
    assert.equal(parse({ kind: "server", connectionId: "c1" }).success, true)
    assert.equal(parse({ kind: "servers" }).success, false)
    assert.equal(
        parse({ kind: "servers", connectionIds: ["c1", "c1"] }).success,
        false
    )
    assert.equal(
        parse({ kind: "servers", connectionIds: ["c1", "c2"] }).success,
        true
    )
    assert.equal(
        parse({
            kind: "servers",
            connectionIds: Array.from({ length: 11 }, (_, i) => `c${i}`),
        }).success,
        false
    )
    assert.equal(parse({ kind: "results" }).success, false)
    assert.equal(
        parse({ kind: "results", gameId: "hell_let_loose" }).success,
        true
    )
    assert.equal(parse({ kind: "competition" }).success, false)
    assert.equal(parse({ kind: "calendar" }).success, true)
    assert.equal(
        parse({ kind: "results", gameId: "wardogs", reportCategoryId: "x" })
            .success,
        false
    )
})

test("text is trimmed and bounded; unknown fields and bad channels are rejected", () => {
    const parsed = panelSaveSchema.parse({
        kind: "server",
        connectionId: "c1",
        channelId,
        title: "  Vlci   #1  ",
    })
    assert.equal(parsed.title, "Vlci #1")
    assert.deepEqual(parsed.content, DEFAULT_PANEL_CONTENT)
    assert.equal(
        panelSaveSchema.safeParse({
            kind: "server",
            connectionId: "c1",
            channelId,
            title: "x".repeat(81),
        }).success,
        false
    )
    assert.equal(
        panelSaveSchema.safeParse({
            kind: "server",
            connectionId: "c1",
            channelId: "general",
        }).success,
        false
    )
    assert.equal(
        panelSaveSchema.safeParse({
            kind: "server",
            connectionId: "c1",
            channelId,
            password: "secret",
        }).success,
        false
    )
})
