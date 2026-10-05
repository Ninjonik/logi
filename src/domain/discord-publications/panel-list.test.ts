import assert from "node:assert/strict"
import test from "node:test"

import {
    leagueRows,
    panelListGroup,
    panelPollInterval,
    panelRowActions,
    panelStateCounts,
    panelTimingParts,
    sourceLiveRead,
    type PanelTimingInput,
} from "./panel-list"

const now = 1_000_000
const timing = (overrides: Partial<PanelTimingInput>): PanelTimingInput => ({
    source: "panel",
    kind: "server",
    state: "published",
    now,
    savedAt: 900_000,
    requestedAt: null,
    lastUpdateAt: now - 12_000,
    lastAttemptAt: now - 12_000,
    nextUpdateAt: now + 48_000,
    pausedAt: null,
    pausedBy: null,
    messages: 1,
    hasMessage: true,
    ...overrides,
})

test("panels group in board order: live, combined, control, results, league, calendar", () => {
    assert.equal(panelListGroup("server"), "live")
    assert.equal(panelListGroup("servers"), "combined")
    assert.equal(panelListGroup("results"), "results")
    assert.equal(panelListGroup("league"), "league")
    assert.equal(panelListGroup("calendar"), "calendar")
    assert.equal(panelListGroup("competition"), "competition")
})

test("row buttons follow the state (P1-13..22)", () => {
    const buttons = (
        state: Parameters<typeof panelRowActions>[0]["state"],
        kind = "server" as const
    ) => panelRowActions({ source: "panel", kind, state })
    assert.deepEqual(buttons("published"), {
        buttons: ["edit", "refresh", "pause"],
        errorBox: false,
    })
    // P1-15, P1-16: a failing panel offers pause and the error box with retry.
    assert.deepEqual(buttons("error"), {
        buttons: ["edit", "pause"],
        errorBox: true,
    })
    // P1-17: an unsent panel is sent with the primary button.
    assert.deepEqual(buttons("unsent").buttons, ["edit", "publish"])
    // P1-21, P1-22.
    assert.deepEqual(buttons("waiting").buttons, ["edit", "pause"])
    assert.deepEqual(buttons("paused").buttons, ["edit", "resume"])
    // P1-19: results are event driven, no "Obnovit teď".
    assert.deepEqual(
        panelRowActions({
            source: "panel",
            kind: "results",
            state: "published",
        }).buttons,
        ["edit", "pause"]
    )
    // P1-18: the control message is edited on the seed page and refreshed.
    assert.deepEqual(
        panelRowActions({ source: "control", kind: null, state: "published" }),
        { buttons: ["edit", "refresh"], errorBox: false }
    )
})

test("a published panel says when it updated and when it refreshes next", () => {
    assert.deepEqual(panelTimingParts(timing({})), [
        { kind: "updated", at: now - 12_000 },
        { kind: "nextRefresh", at: now + 48_000 },
        { kind: "open" },
    ])
    // A refresh already due never counts down below now.
    assert.deepEqual(
        panelTimingParts(timing({ nextUpdateAt: now - 5_000 }))[1],
        { kind: "nextRefresh", at: now }
    )
})

test("an error says the last attempt, the next retry and that no message exists (P1-15)", () => {
    assert.deepEqual(
        panelTimingParts(
            timing({
                state: "error",
                lastAttemptAt: now - 40_000,
                nextUpdateAt: now + 20_000,
                hasMessage: false,
            })
        ),
        [
            { kind: "lastAttempt", at: now - 40_000 },
            { kind: "nextRetry", at: now + 20_000 },
            { kind: "notInDiscord" },
        ]
    )
})

test("unsent, waiting, paused and results rows (P1-17, P1-19, P1-21, P1-22)", () => {
    assert.deepEqual(panelTimingParts(timing({ state: "unsent" })), [
        { kind: "saved", at: 900_000 },
        { kind: "notSentYet" },
    ])
    assert.deepEqual(
        panelTimingParts(
            timing({ state: "waiting", requestedAt: now - 8_000 })
        ),
        [{ kind: "requested", at: now - 8_000 }, { kind: "pickup" }]
    )
    assert.deepEqual(
        panelTimingParts(timing({ state: "waiting", requestedAt: null })),
        [{ kind: "firstPass" }]
    )
    assert.deepEqual(
        panelTimingParts(
            timing({ state: "paused", pausedAt: 5, pausedBy: "Hráč 01" })
        ),
        [
            { kind: "pausedBy", by: "Hráč 01", at: 5 },
            { kind: "pausedKeeps" },
            { kind: "open" },
        ]
    )
    assert.deepEqual(
        panelTimingParts(timing({ kind: "results", messages: 12 })),
        [
            { kind: "lastResult", at: now - 12_000 },
            { kind: "resultsInChannel", count: 12 },
            { kind: "resultsBackfill" },
        ]
    )
    assert.deepEqual(
        panelTimingParts(
            timing({
                source: "control",
                kind: null,
                lastUpdateAt: now - 12_000,
            })
        ),
        [
            { kind: "updated", at: now - 12_000 },
            { kind: "controlButtons" },
            { kind: "open" },
        ]
    )
})

test("summary chips count only states that occur, in board order (P1-11)", () => {
    assert.deepEqual(
        panelStateCounts(["paused", "published", "error", "published"]),
        [
            { state: "published", count: 2 },
            { state: "error", count: 1 },
            { state: "paused", count: 1 },
        ]
    )
})

test("the page polls faster while the bot owes an answer (P1-B09)", () => {
    assert.equal(panelPollInterval(["published"]), 5_000)
    assert.equal(panelPollInterval(["published", "waiting"]), 2_000)
})

test("a WD League panel lists one row per message it owns (P1-20, P1-21)", () => {
    assert.deepEqual(leagueRows(null), ["league-table", "league-fixtures"])
    assert.deepEqual(
        leagueRows({ table: false, fixtures: false, recentResults: true }),
        ["league-fixtures"]
    )
    assert.deepEqual(
        leagueRows({ table: true, fixtures: false, recentResults: false }),
        ["league-table"]
    )
})

test("live data of a source comes from its own panel's reads (P1-08, P1-B07)", () => {
    const panel = {
        kind: "server" as const,
        connectionId: "hll-1",
        warnings: [] as string[],
        dataAt: now - 30_000,
    }
    assert.equal(
        sourceLiveRead({ connectionId: "hll-1", now, panels: [panel] }),
        "ok"
    )
    assert.equal(
        sourceLiveRead({
            connectionId: "hll-1",
            now,
            panels: [{ ...panel, warnings: ["live_data_unavailable"] }],
        }),
        "limited"
    )
    assert.equal(
        sourceLiveRead({
            connectionId: "hll-1",
            now,
            panels: [{ ...panel, dataAt: now - 10 * 60_000 }],
        }),
        null
    )
    // "Naše servery" shows collected data; it proves no live read.
    assert.equal(
        sourceLiveRead({
            connectionId: "hll-1",
            now,
            panels: [{ ...panel, kind: "servers" }],
        }),
        null
    )
})
