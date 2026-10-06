import assert from "node:assert/strict"
import test from "node:test"

import {
    panelOverviewItems,
    panelStatus,
    panelToggleAction,
    parseSavedPanels,
} from "./panel-overview"

const panel = (overrides: Record<string, unknown> = {}) => ({
    _id: "p1",
    guildId: "g",
    kind: "server",
    connectionId: "c1",
    channelId: "100000000000000001",
    enabled: true,
    showPlayers: true,
    showLeaders: false,
    artwork: true,
    refreshSeconds: 60,
    publications: [{ messageId: "1", error: null }],
    ...overrides,
})

test("the status chip follows the last delivery (N1-B08)", () => {
    assert.deepEqual(panelStatus({ enabled: false, publications: [] }), {
        status: "paused",
    })
    assert.deepEqual(
        panelStatus({
            enabled: true,
            publications: [
                { messageId: "1", error: "Panel se neaktualizoval." },
            ],
        }),
        { status: "error", error: "Panel se neaktualizoval." }
    )
    assert.deepEqual(panelStatus({ enabled: true, publications: [] }), {
        status: "unsent",
    })
    assert.deepEqual(
        panelStatus({ enabled: true, publications: [{ messageId: "1" }] }),
        {}
    )
})

test("the overview lists the panels in the board's order with names and games", () => {
    const panels = parseSavedPanels({
        panels: [
            panel({ _id: "r", kind: "results", enabled: false }),
            panel(),
            { broken: true },
        ],
    })
    assert.equal(panels.length, 2)
    const items = panelOverviewItems({
        panels,
        sources: new Map([
            ["c1", { name: "Vlci #1 · Public", gameId: "hell_let_loose" }],
        ]),
        seed: { configured: true, enabled: true, controlChannelId: "5" },
        calendar: { channelId: "6" },
        wardogs: true,
    })
    assert.deepEqual(
        items.map((item) => [
            item.kind,
            item.name,
            item.status,
            item.toggleable,
        ]),
        [
            ["live", "Vlci #1 · Public", undefined, true],
            ["control", undefined, undefined, false],
            ["results", "Vlci #1 · Public", "paused", true],
            ["league", undefined, undefined, false],
            ["calendar", undefined, "unsent", false],
        ]
    )
    assert.equal(items[0]?.game, "hell_let_loose")
    assert.equal(
        panelOverviewItems({
            panels: [],
            sources: new Map(),
            calendar: {},
            wardogs: false,
        })
            .map((item) => [item.kind, item.enabled])
            .join(),
        "calendar,false"
    )
})

test("a switch pauses or resumes the panel; the paused flag wins over enabled", () => {
    assert.equal(panelToggleAction(false), "pause")
    assert.equal(panelToggleAction(true), "resume")
    const items = panelOverviewItems({
        panels: parseSavedPanels({
            panels: [
                panel({ _id: "a", paused: true }),
                panel({ _id: "b", enabled: false, paused: false }),
                panel({ _id: "c", draft: true, publications: [] }),
            ],
        }),
        sources: new Map(),
        calendar: {},
        wardogs: false,
    }).filter((item) => item.panelId)
    assert.deepEqual(
        items.map((item) => [
            item.panelId,
            item.status,
            item.enabled,
            item.toggleable,
        ]),
        [
            ["a", "paused", false, true],
            ["b", undefined, true, true],
            ["c", "unsent", false, false],
        ]
    )
})
