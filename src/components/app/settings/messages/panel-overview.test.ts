import assert from "node:assert/strict"
import test from "node:test"

import {
    BOARD_EVENT_CATEGORIES,
    BOARD_PANEL_CHANNELS,
    boardPanelOverview,
} from "@/infrastructure/testing/panel-overview"
import { getDictionary } from "@/i18n/dictionaries"

import {
    messagesPanelRows,
    panelToggleAction,
    worstPanelState,
    type MessagesPanelInput,
} from "./panel-overview"

const now = Date.parse("2026-10-05T16:00:00.000Z")
const input = (
    overrides: Partial<MessagesPanelInput> = {}
): MessagesPanelInput => ({
    overview: boardPanelOverview(now),
    dictionary: getDictionary("cs"),
    channels: BOARD_PANEL_CHANNELS,
    categories: BOARD_EVENT_CATEGORIES,
    competitions: [],
    seed: { configured: true, enabled: true },
    calendarSetting: null,
    hrefs: { panels: "/cs/x/discord-panels", seed: "/cs/x/discord-seed" },
    ...overrides,
})

test("every panel of the P1 overview is a row in board order with its real chip (N1-29..36, N1-B08)", () => {
    const rows = messagesPanelRows(input())
    assert.deepEqual(
        rows.map((row) => [row.title, row.game, row.chip]),
        [
            ["Vlci #1 · Public", "hell_let_loose", null],
            ["Vlci #2 · Trénink a zápasy", "hell_let_loose", null],
            ["Vlci WD", "wardogs", "error"],
            ["Naše servery", null, "unsent"],
            ["Ovládání serveru", null, null],
            ["Výsledky HLL", null, null],
            ["WD League", "wardogs", null],
            ["Kalendář", null, "paused"],
        ]
    )
    assert.deepEqual(
        rows.map((row) => row.detail),
        [
            "Živý server · obnovuje se každých 60 s · tlačítka Připojit se, Zobrazit hráče a Nahlásit hráče",
            "Živý server v soukromém kanálu · ukazuje i heslo serveru",
            "Bot nemá oprávnění Vkládat odkazy v #servery-wd",
            "Vlci #1, Vlci #2 a Vlci WD v jedné zprávě",
            "Seed, Obnovit a Pozastavit · smí jen Správci Logi",
            "Po potvrzení výsledku v Logi · po vytvoření pošle posledních 5 potvrzených",
            "Dvě zprávy pod sebou: tabulka a nejbližší zápasy celé ligy · obnovují se každých 60 s",
            "Nadcházející akce klanu, kategorie Zápas a Liga · pozastavil Hráč 01",
        ]
    )
    // Switch names (N1-45a), states and editor links.
    assert.deepEqual(
        rows.map((row) => [row.switchLabel, row.enabled, row.toggleable]),
        [
            ["Panel Vlci #1 · Public", true, true],
            ["Panel Vlci #2 · Trénink a zápasy", true, true],
            ["Panel Vlci WD", true, true],
            // Not sent yet: sent from "Panely v Discordu", not paused here.
            ["Panel Naše servery", true, false],
            ["Ovládání serveru", true, false],
            ["Panel Výsledky HLL", true, true],
            ["Panely WD League", true, true],
            ["Panel Kalendář", false, true],
        ]
    )
    assert.equal(rows[0]!.href, "/cs/x/discord-panels/p-v1")
    assert.equal(rows[4]!.href, "/cs/x/discord-seed")
    assert.deepEqual(rows[4]!.channelIds, ["200000000000000004"])
})

test("waiting and per-message League states reach the chip", () => {
    const overview = boardPanelOverview(now)
    const league = overview.panels.find((panel) => panel.kind === "league")!
    league.parts = [
        { ...league.parts[0]!, state: "published" },
        { ...league.parts[1]!, state: "waiting" },
    ]
    const v1 = overview.panels.find((panel) => panel.id === "p-v1")!
    v1.state = "waiting"
    const rows = messagesPanelRows(input({ overview }))
    assert.equal(rows.find((row) => row.title === "WD League")!.chip, "waiting")
    assert.equal(
        rows.find((row) => row.title === "Vlci #1 · Public")!.chip,
        "waiting"
    )
    assert.equal(worstPanelState(["published", "error", "waiting"]), "error")
    assert.equal(worstPanelState([]), "published")
})

test("the buttons named on a live row follow the panel's switches", () => {
    const overview = boardPanelOverview(now)
    const v1 = overview.panels.find((panel) => panel.id === "p-v1")!
    v1.settings = {
        ...v1.settings,
        reportCategoryId: undefined,
        content: { ...v1.settings.content, joinButton: false },
    }
    assert.equal(
        messagesPanelRows(input({ overview }))[0]!.detail,
        "Živý server · obnovuje se každých 60 s · tlačítka Zobrazit hráče"
    )
})

test("the calendar saved before panels is listed until a calendar panel exists (N1-47)", () => {
    const overview = boardPanelOverview(now)
    overview.panels = overview.panels.filter(
        (panel) => panel.kind !== "calendar"
    )
    const rows = messagesPanelRows(
        input({
            overview,
            calendarSetting: {
                channelId: "200000000000000007",
                posted: false,
            },
        })
    )
    const calendar = rows.find((row) => row.key === "calendar-setting")!
    assert.equal(calendar.chip, "waiting")
    assert.equal(calendar.toggleable, false)
    assert.equal(calendar.href, "/cs/x/discord-panels/new?type=calendar")
    // With a calendar panel the old setting is not listed.
    assert.ok(
        !messagesPanelRows(
            input({
                calendarSetting: {
                    channelId: "200000000000000007",
                    posted: true,
                },
            })
        ).some((row) => row.key === "calendar-setting")
    )
})

test("without a seed plan or control message there is no control row", () => {
    const overview = boardPanelOverview(now)
    overview.controls = []
    assert.ok(
        !messagesPanelRows(input({ overview, seed: null })).some(
            (row) => row.key === "control"
        )
    )
    // A switched-on seed without a control channel has not sent it yet.
    assert.equal(
        messagesPanelRows(
            input({ overview, seed: { configured: true, enabled: true } })
        ).find((row) => row.key === "control")!.chip,
        "unsent"
    )
})

test("every locale words the rows", () => {
    for (const locale of ["en", "de"] as const) {
        const rows = messagesPanelRows(
            input({ dictionary: getDictionary(locale) })
        )
        assert.equal(rows.length, 8)
        for (const row of rows)
            assert.doesNotMatch(row.detail, /\{\w+\}|undefined/, row.detail)
    }
})

test("a panel switch pauses or resumes the panel (N1-B09)", () => {
    assert.equal(panelToggleAction(false), "pause")
    assert.equal(panelToggleAction(true), "resume")
})
