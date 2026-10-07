import assert from "node:assert/strict"
import test from "node:test"

import { DEFAULT_PANEL_CONTENT } from "@/domain/discord-publications/settings"
import { getDictionary } from "@/i18n/dictionaries"

import type { PanelOverviewItem, PanelOverviewResponse } from "./panels-api"
import { panelRows } from "./panel-rows"

const now = Date.parse("2026-10-05T16:00:00.000Z")
const dictionary = getDictionary("cs")
const channels = [
    { id: "200000000000000001", name: "servery" },
    { id: "200000000000000003", name: "servery-wd" },
    { id: "200000000000000004", name: "spravci" },
    { id: "200000000000000006", name: "liga" },
]
const item = (overrides: Partial<PanelOverviewItem>): PanelOverviewItem => ({
    id: "p1",
    kind: "server",
    gameId: "hell_let_loose",
    channelId: "200000000000000001",
    connectionId: "hll-1",
    connectionIds: [],
    title: null,
    state: "published",
    paused: false,
    pausedAt: null,
    pausedBy: null,
    revision: 1,
    settings: {
        kind: "server",
        channelId: "200000000000000001",
        connectionId: "hll-1",
        showPlayers: true,
        showLeaders: true,
        artwork: true,
        content: DEFAULT_PANEL_CONTENT,
    },
    timeline: {
        savedAt: now - 60_000,
        savedBy: null,
        requestedAt: null,
        claimedAt: null,
        sentAt: now - 50_000,
        lastUpdateAt: now - 12_000,
        lastAttemptAt: now - 12_000,
        nextUpdateAt: now + 48_000,
        dataAt: now - 6_000,
    },
    error: null,
    lastError: null,
    recoveredAt: null,
    sent: true,
    channelPrivate: false,
    uncertain: false,
    warnings: [],
    message: {
        channelId: "200000000000000001",
        messageId: "300000000000000001",
    },
    messages: 1,
    parts: [],
    style: "a",
    ...overrides,
})
const overview = (
    panels: PanelOverviewItem[],
    controls: PanelOverviewResponse["controls"] = []
): PanelOverviewResponse => ({
    bot: { state: "unknown" },
    botInServer: null,
    counts: { published: 0, error: 0, waiting: 0, unsent: 0, paused: 0 },
    panels,
    sources: [
        {
            connectionId: "hll-1",
            name: "Vlci #1 · Public",
            gameId: "hell_let_loose",
            provider: "hll_crcon",
            collecting: true,
            lastDataAt: now - 40_000,
            freshness: "fresh",
            errorCategory: null,
        },
        {
            connectionId: "wd-1",
            name: "Vlci WD",
            gameId: "wardogs",
            provider: "wardogs_warcon",
            collecting: true,
            lastDataAt: now - 52_000,
            freshness: "fresh",
            errorCategory: null,
        },
    ],
    servers: [],
    controls,
    people: { u1: "Hráč 01" },
    emoji: {},
})
const context = {
    dictionary,
    locale: "cs",
    guildId: "100000000000000001",
    channels,
    now,
    categories: [],
    competitions: [],
}

test("a live server row names the server, game, provider, channel and privacy (P1-13)", () => {
    const [group] = panelRows(overview([item({})]), context)
    assert.equal(group!.group, "live")
    const row = group!.rows[0]!
    assert.equal(row.title, "Vlci #1 · Public")
    assert.deepEqual(
        row.meta.map((meta) => ("text" in meta ? meta.text : meta.label)),
        ["HLL", "CRCON", "# servery", "veřejný kanál"]
    )
    assert.equal(
        row.messageUrl,
        "https://discord.com/channels/100000000000000001/200000000000000001/300000000000000001"
    )
    assert.deepEqual(row.actions.buttons, ["edit", "refresh", "pause"])
})

test("a failing panel carries the plain cause with the fix (P1-16)", () => {
    const [group] = panelRows(
        overview([
            item({
                connectionId: "wd-1",
                channelId: "200000000000000003",
                state: "error",
                message: null,
                error: {
                    code: "missing_permissions",
                    at: now - 40_000,
                    permissions: ["embed_links"],
                },
            }),
        ]),
        context
    )
    const row = group!.rows[0]!
    assert.equal(
        row.error?.title,
        "Bot nemá oprávnění Vkládat odkazy v #servery-wd."
    )
    assert.match(
        row.error!.fix,
        /zapněte Vkládat odkazy\. Pak klikněte Zkusit znovu\./
    )
    assert.ok(row.actions.errorBox)
    assert.deepEqual(row.timing[row.timing.length - 1], {
        kind: "notInDiscord",
    })
})

test("WD League lists its two messages and the paused calendar names who paused it", () => {
    const groups = panelRows(
        overview([
            item({
                id: "lg",
                kind: "league",
                gameId: "wardogs",
                channelId: "200000000000000006",
                connectionId: null,
                settings: {
                    ...item({}).settings,
                    kind: "league",
                    league: {
                        table: true,
                        fixtures: true,
                        recentResults: true,
                        fixtureCount: 6,
                    },
                },
            }),
            item({
                id: "cal",
                kind: "calendar",
                gameId: "any",
                connectionId: null,
                state: "paused",
                paused: true,
                pausedBy: "u1",
                pausedAt: now - 3_600_000,
            }),
        ]),
        context
    )
    const league = groups.find((group) => group.group === "league")!
    assert.deepEqual(
        league.rows.map((row) => row.title),
        ["WD League · tabulka", "WD League · nejbližší zápasy"]
    )
    assert.ok(
        league.rows[1]!.meta.some(
            (meta) =>
                meta.kind === "text" &&
                meta.text === "6 nejbližších zápasů a poslední výsledky"
        )
    )
    const calendar = groups.find((group) => group.group === "calendar")!
        .rows[0]!
    assert.deepEqual(calendar.timing[0], {
        kind: "pausedBy",
        by: "Hráč 01",
        at: now - 3_600_000,
    })
    assert.deepEqual(calendar.actions.buttons, ["edit", "resume"])
})

test("each WD League message has its own state; the buttons act on both (P1-20, P1-21)", () => {
    const league = item({
        id: "lg",
        kind: "league",
        gameId: "wardogs",
        channelId: "200000000000000006",
        connectionId: null,
        state: "waiting",
        timeline: {
            ...item({}).timeline,
            requestedAt: now - 8_000,
        },
        settings: {
            ...item({}).settings,
            kind: "league",
            league: {
                table: true,
                fixtures: true,
                recentResults: true,
                fixtureCount: 6,
            },
        },
        parts: [
            {
                part: "standings",
                state: "published",
                lastUpdateAt: now - 30_000,
                uncertain: false,
                message: {
                    channelId: "200000000000000006",
                    messageId: "300000000000000006",
                },
            },
            {
                part: "fixtures",
                state: "waiting",
                lastUpdateAt: null,
                uncertain: false,
                message: null,
            },
        ],
    })
    const rows = panelRows(overview([league]), context).find(
        (group) => group.group === "league"
    )!.rows
    assert.deepEqual(
        rows.map((row) => [row.title, row.state]),
        [
            ["WD League · tabulka", "published"],
            ["WD League · nejbližší zápasy", "waiting"],
        ]
    )
    // Zveřejněno: its own time and link; Čeká na bota: the request.
    assert.deepEqual(rows[0]!.timing.slice(0, 1), [
        { kind: "updated", at: now - 30_000 },
    ])
    assert.equal(
        rows[0]!.messageUrl,
        "https://discord.com/channels/100000000000000001/200000000000000006/300000000000000006"
    )
    assert.deepEqual(rows[0]!.actions.buttons, ["edit", "refresh", "pause"])
    assert.deepEqual(rows[1]!.timing, [
        { kind: "requested", at: now - 8_000 },
        { kind: "pickup" },
        { kind: "leagueBoth" },
    ])
    assert.equal(rows[1]!.messageUrl, null)
    assert.deepEqual(rows[1]!.actions.buttons, ["edit", "pause"])
    // Both rows act on the one panel and say so.
    assert.deepEqual(
        rows.map((row) => row.panelId),
        ["lg", "lg"]
    )
    for (const row of rows)
        assert.deepEqual(row.timing[row.timing.length - 1], {
            kind: "leagueBoth",
        })
})

test("a failing WD League message shows the panel's cause; an unconfirmed one says so", () => {
    const league = (uncertain: boolean) =>
        item({
            id: "lg",
            kind: "league",
            gameId: "wardogs",
            channelId: "200000000000000006",
            connectionId: null,
            state: "error",
            error: {
                code: "missing_permissions",
                at: now - 10_000,
                permissions: ["attach_files"],
            },
            settings: {
                ...item({}).settings,
                kind: "league",
                league: {
                    table: true,
                    fixtures: false,
                    recentResults: false,
                    fixtureCount: 6,
                },
            },
            parts: [
                {
                    part: "standings",
                    state: "error",
                    lastUpdateAt: now - 90_000,
                    uncertain,
                    message: null,
                },
                {
                    part: "fixtures",
                    state: "published",
                    lastUpdateAt: now - 5_000,
                    uncertain: false,
                    message: null,
                },
            ],
        })
    const rowOf = (uncertain: boolean) =>
        panelRows(overview([league(uncertain)]), context).find(
            (group) => group.group === "league"
        )!.rows
    const [table] = rowOf(false)
    assert.equal(rowOf(false).length, 1)
    assert.equal(table!.state, "error")
    assert.equal(
        table!.error?.title,
        "Bot nemá oprávnění Přikládat soubory v #liga."
    )
    assert.ok(table!.actions.errorBox)
    assert.equal(
        rowOf(true)[0]!.error?.title,
        "Discord nepotvrdil, jestli zprávu přijal."
    )
})

test("seed control messages are their own group (P1-18)", () => {
    const groups = panelRows(
        overview(
            [],
            [
                {
                    connectionId: "hll-1",
                    channelId: "200000000000000004",
                    state: "published",
                    lastUpdateAt: now - 12_000,
                    failed: false,
                    message: {
                        channelId: "200000000000000004",
                        messageId: "300000000000000009",
                    },
                },
            ]
        ),
        context
    )
    assert.equal(groups.length, 1)
    const row = groups[0]!.rows[0]!
    assert.equal(groups[0]!.group, "control")
    assert.equal(row.title, "Ovládání serveru")
    assert.equal(row.panelId, null)
    assert.ok(
        row.meta.some(
            (meta) => meta.kind === "text" && meta.text === "jen Správci Logi"
        )
    )
    assert.deepEqual(row.actions.buttons, ["edit", "refresh"])
})

test("a calendar channel saved before panels existed is listed until a calendar panel takes it over (N1-47)", () => {
    const calendarSetting = {
        channelId: "200000000000000006",
        message: {
            channelId: "200000000000000006",
            messageId: "300000000000000010",
        },
    }
    const groups = panelRows(overview([]), { ...context, calendarSetting })
    const row = groups.find((group) => group.group === "calendar")!.rows[0]!
    assert.equal(row.source, "calendar-setting")
    assert.equal(row.panelId, null)
    assert.equal(row.state, "published")
    assert.deepEqual(row.actions.buttons, ["edit"])
    assert.match(row.messageUrl ?? "", /300000000000000010$/)
    const withPanel = panelRows(
        overview([
            item({
                id: "cal",
                kind: "calendar",
                gameId: "any",
                connectionId: null,
            }),
        ]),
        { ...context, calendarSetting }
    )
    assert.deepEqual(
        withPanel
            .find((group) => group.group === "calendar")!
            .rows.map((entry) => entry.source),
        ["panel"]
    )
})
