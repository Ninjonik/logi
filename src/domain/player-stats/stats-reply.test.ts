import assert from "node:assert/strict"
import test from "node:test"

import {
    buildStatsView,
    statsCoverageLines,
    statsDataTime,
    statsErrorCard,
    statsSharePromptView,
    type StatsViewInput,
} from "./stats-reply"
import { viewButtons, viewText } from "@/infrastructure/testing/discord-view"
import { exampleWardogsStats, statsPreviewView } from "./stats-preview"
import { getCommandMessages } from "@/lib/clan-language/commands"
import type { WardogsPlayerStats } from "./player-stats"
import { statsCopy } from "./stats-copy"

const cs = statsCopy("cs")
const STEAM = "76561198000000017"
const fetchedAt = "2026-10-11T18:41:00Z"

function wardogs(): WardogsPlayerStats {
    const stats = exampleWardogsStats("Hráč 17")
    stats.player.metrics.kills.knownGames = 21
    stats.player.metrics.deaths.knownGames = 21
    stats.recent = [
        {
            id: "g1",
            endedAt: "2026-10-03T17:00:00Z",
            map: "Zestafona",
            server: "Vlci #1",
            platform: "steam",
            platformId: STEAM,
            name: "Hráč 17",
            faction: "Valkyra",
            result: "win",
            metrics: { kills: 18, deaths: 11 },
        },
        {
            id: "g2",
            endedAt: "2026-10-02T17:00:00Z",
            map: "Kaluga",
            server: "Vlci #1",
            platform: "steam",
            platformId: STEAM,
            name: "Hráč 17",
            faction: "Manticore",
            result: "loss",
            metrics: { kills: 9, deaths: 14 },
        },
        {
            id: "g3",
            endedAt: "2026-09-30T17:00:00Z",
            map: "Brzeg",
            server: "Vlci #1",
            platform: "steam",
            platformId: STEAM,
            name: "Hráč 17",
            faction: "Valkyra",
            result: null,
            metrics: { kills: 12, deaths: 12 },
        },
    ] as WardogsPlayerStats["recent"]
    stats.factions = [
        { name: "Lonestar", color: null, matches: 4, wins: 2, kills: 77 },
        { name: "Manticore", color: null, matches: 7, wins: 4, kills: 121 },
        { name: "Valkyra", color: null, matches: 12, wins: 8, kills: 214 },
    ]
    return stats
}

const base = (overrides: Partial<StatsViewInput> = {}): StatsViewInput => ({
    copy: cs,
    locale: "cs-CZ",
    timeZone: "Europe/Prague",
    game: "wardogs",
    period: "30d",
    result: {
        kind: "wardogs",
        steamId: STEAM,
        name: "Hráč 17",
        stats: wardogs(),
        fetchedAt,
    },
    view: "overview",
    self: true,
    controls: { id: (action) => `stats:abc:${action}`, share: true },
    ...overrides,
})

test("the Wardogs overview: label, three numbers, detail, coverage, buttons and source (M2-12..16)", () => {
    const view = buildStatsView(base())
    assert.equal(view.ephemeral, true)
    assert.equal(view.accent, "clan", "clan colour, not Wardogs gold")
    const text = viewText(view)
    assert.match(text, /WARDOGS · POSLEDNÍCH 30 DNÍ/)
    assert.match(text, /### Hráč 17/)
    assert.match(
        text,
        /Zabití \*\*412\*\* · K\/D \*\*1,37\*\* · Výhry \*\*14 \/ 23\*\*/
    )
    assert.match(
        text,
        /Úspěšnost 61 % · odehráno 31 h · změna cash \+18\u00a0400/
    )
    assert.match(text, /Zabití a K\/D známe z 21 z 23 her\./)
    assert.match(
        text,
        /Zdroj: Warcon klanu · 23 her na serverech klanu · data z <t:\d+:t>/
    )
    assert.doesNotMatch(text, /Spravováno|cashDelta|Obnovit/)
    assert.deepEqual(
        viewButtons(view).map((button) => [
            button.label,
            "style" in button ? button.style : "link",
        ]),
        [
            ["Přehled", "primary"],
            ["Poslední hry", "secondary"],
            ["Frakce", "secondary"],
            ["Sdílet", "secondary"],
        ]
    )
})

test("recent games show a result chip, the faction emblem and the details (M2-17)", () => {
    const view = buildStatsView(base({ view: "recent" }))
    const text = viewText(view)
    assert.match(text, /### Hráč 17 · poslední hry/)
    assert.match(
        text,
        /🟢 \*\*Výhra\*\* ◈ \*\*Valkyra\*\* Zestafona · so 3\. 10\. · 18 zabití, 11 úmrtí/
    )
    assert.match(
        text,
        /🔴 \*\*Prohra\*\* ◈ \*\*Manticore\*\* Kaluga · pá 2\. 10\./
    )
    assert.match(
        text,
        /⚪ \*\*Bez výsledku\*\* ◈ \*\*Valkyra\*\* Brzeg · st 30\. 9\./
    )
    assert.doesNotMatch(text, /🟥|🟩|🟦/, "no coloured squares")
    assert.equal(
        viewButtons(view).find(
            (button) => "style" in button && button.style === "primary"
        )?.label,
        "Poslední hry"
    )
})

test("factions use the installed emblem or the fallback and Czech counts (M2-18)", () => {
    const text = viewText(
        buildStatsView(
            base({
                view: "factions",
                factionEmoji: { valkyra: "<:valkyra:1>" },
            })
        )
    )
    assert.match(text, /### Hráč 17 · frakce/)
    assert.match(text, /<:valkyra:1> \*\*Valkyra\*\* 8 z 12 výher · 214 zabití/)
    assert.match(text, /◈ \*\*Manticore\*\* 4 ze 7 výher · 121 zabití/)
    assert.match(text, /◈ \*\*Lonestar\*\* 2 ze 4 výher · 77 zabití/)
})

test("the HLL overview speaks Czech and links the profile on a second row (M2-19..22)", () => {
    const view = buildStatsView(
        base({
            game: "hll",
            result: {
                kind: "hll",
                steamId: STEAM,
                name: "Hráč 17",
                read: {
                    status: "ok",
                    fetchedAt,
                    reason: null,
                    profile: {
                        steamId: STEAM,
                        name: "Hráč 17",
                        period: "30d",
                        sourceUrl: "https://hllrecords.com/profiles/x",
                        kills: 1284,
                        deaths: 845,
                        kd: 1.52,
                        matches: 37,
                        hours: 41,
                        lowerBound: true,
                        teamKills: 6,
                        elo: 1612,
                        formWinRate: 54,
                        recent: [],
                        maps: [],
                        weapons: [],
                        warnings: [],
                    },
                },
            },
            hllProfileUrl: `https://hllrecords.com/profiles/${STEAM}?period=30d`,
        })
    )
    const text = viewText(view)
    assert.match(text, /HELL LET LOOSE · POSLEDNÍCH 30 DNÍ/)
    assert.match(
        text,
        /Zabití \*\*1\u00a0284\*\* · K\/D \*\*1,52\*\* · Hry \*\*37\+\*\*/
    )
    assert.match(
        text,
        /Odehráno 41\+ h · ELO pěchoty 1\u00a0612 · zabití spoluhráčů 6/
    )
    assert.match(
        text,
        /Forma: 54 % výher v posledních 100 hrách delších než 20 min/
    )
    assert.match(
        text,
        /Zdroj: HLL Records · jen sledované komunitní servery · \+ znamená nejméně/
    )
    assert.doesNotMatch(text, /Infantry|TK/)
    const rows = view.blocks.filter((block) => block.kind === "buttons")
    assert.deepEqual(
        rows.map((row) =>
            row.kind === "buttons"
                ? row.buttons.map((button) => button.label)
                : []
        ),
        [
            ["Přehled", "Poslední hry", "Zbraně", "Mapy", "Sdílet"],
            ["Profil na HLL Records"],
        ]
    )
})

test("the shared card has no buttons and names who shared it (M2-23)", () => {
    const view = buildStatsView(
        base({
            controls: undefined,
            shared: { userId: "100000000000000017", at: fetchedAt },
        })
    )
    assert.equal(view.ephemeral, false)
    const text = viewText(view)
    assert.match(
        text,
        /Sdílel <@100000000000000017> · stav k ne <t:\d+:d> · <t:\d+:t>/
    )
    assert.match(text, /Warcon klanu · Spravováno v Logi/)
    assert.deepEqual(viewButtons(view), [])
})

test("missing Steam asks to add it with one primary button (M2-27)", () => {
    const view = buildStatsView(
        base({ result: { kind: "missing_link", account: { name: null } } })
    )
    const text = viewText(view)
    assert.match(text, /### Chybí ti Steam účet/)
    assert.match(
        text,
        /Statistiky hledáme podle Steam ID\. Přidej ho a hned je načteme\./
    )
    assert.match(
        text,
        /Je to tvoje prohlášení pro veřejné statistiky, ne ověření\. Ověřený Steam propojíš v Logi → Můj účet\./
    )
    assert.deepEqual(viewButtons(view), [
        { label: "Přidat Steam", style: "primary", id: "stats:abc:link" },
    ])
    assert.equal(cs.modalTitle, "Propojit Steam")
    assert.equal(cs.modalLabel, "Steam ID nebo odkaz na profil")
    assert.equal(
        cs.modalPlaceholder,
        "76561198… nebo steamcommunity.com/profiles/…"
    )
})

test("another member without Steam is a short card (M2-33)", () => {
    assert.match(
        viewText(
            buildStatsView(
                base({
                    self: false,
                    result: {
                        kind: "missing_link",
                        account: { name: "Hráč 23" },
                    },
                })
            )
        ),
        /Hráč 23 nemá propojený Steam\nMůže si ho přidat sám přes \/stats\./
    )
})

test("an empty period suggests a longer one (M2-29, M2-B07)", () => {
    const text = viewText(
        buildStatsView(
            base({
                period: "7d",
                result: {
                    kind: "wardogs",
                    steamId: STEAM,
                    name: "Hráč 17",
                    stats: null,
                    fetchedAt,
                },
            })
        )
    )
    assert.match(text, /WARDOGS · POSLEDNÍCH 7 DNÍ/)
    assert.match(
        text,
        /Za posledních 7 dní nemáš na serverech klanu žádnou hru\./
    )
    assert.match(
        text,
        /Zkus delší období: \/stats hra: Wardogs období: 30 dní\./
    )
    assert.match(text, /Zdroj: Warcon klanu · data z <t:\d+:t>/)
})

test("source errors and switched-off games are short cards (M2-30..32)", () => {
    assert.match(
        viewText(statsErrorCard(cs, "unavailable_warcon")),
        /Statistiky se teď nedají načíst\nWarcon klanu neodpovídá\. Tvůj Steam zůstává uložený, zkus to za pár minut\./
    )
    const blocked = statsErrorCard(cs, "blocked", {
        hllProfileUrl: "https://hllrecords.com/profiles/x",
    })
    assert.match(
        viewText(blocked),
        /HLL Records teď bota nepustí\nProfil si otevři sám\. Tvůj Steam zůstává uložený\./
    )
    assert.deepEqual(viewButtons(blocked), [
        {
            label: "Profil na HLL Records",
            link: "https://hllrecords.com/profiles/x",
        },
    ])
    assert.match(
        viewText(statsErrorCard(cs, "game_disabled", { gameLabel: "Wardogs" })),
        /Statistiky Wardogs jsou tu vypnuté\nZapnout je může správce v Logi → Nastavení → Příkazy\./
    )
    // The page is "Příkazy" since the redesign (N3-01), in every language.
    for (const [language, page] of [
        ["en", /Logi → Settings → Commands\./],
        ["de", /Logi → Einstellungen → Befehle einschalten\./],
    ] as const)
        assert.match(
            viewText(
                statsErrorCard(statsCopy(language), "game_disabled", {
                    gameLabel: "Wardogs",
                })
            ),
            page
        )
})

test("the shared card's time is the data's time: Warcon collection or the HLL read (M2-23)", () => {
    assert.equal(
        statsDataTime({
            kind: "wardogs",
            steamId: STEAM,
            name: null,
            stats: wardogs(),
            fetchedAt,
        }),
        fetchedAt
    )
    assert.equal(
        statsDataTime({
            kind: "hll",
            steamId: STEAM,
            name: null,
            read: {
                status: "stale",
                profile: null,
                fetchedAt: "2026-10-10T08:00:00Z",
                reason: null,
            },
        }),
        "2026-10-10T08:00:00Z"
    )
    assert.equal(
        statsDataTime({ kind: "missing_link", account: { name: null } }),
        null
    )
    const shared = viewText(
        buildStatsView({
            copy: cs,
            locale: "cs-CZ",
            timeZone: "Europe/Prague",
            game: "wardogs",
            period: "30d",
            result: {
                kind: "wardogs",
                steamId: STEAM,
                name: null,
                stats: wardogs(),
                fetchedAt,
            },
            view: "overview",
            self: true,
            shared: { userId: "222222222222222222", at: fetchedAt },
        })
    )
    const at = Date.parse(fetchedAt) / 1000
    assert.match(shared, new RegExp(`stav k \\S+ <t:${at}:d> · <t:${at}:t>`))
})

test("the share prompt and an invalid Steam ID offer one next step", () => {
    assert.match(
        viewText(statsSharePromptView(cs, "stats:abc:overview")),
        /### Kam kartu poslat\?\n\[Zpět\]/
    )
    assert.deepEqual(
        viewButtons(
            statsErrorCard(cs, "invalid_steam", { retryId: "stats:abc:link" })
        ),
        [{ label: "Zadat znovu", style: "primary", id: "stats:abc:link" }]
    )
})

test("coverage names each incomplete metric once", () => {
    const player = exampleWardogsStats("x").player
    player.metrics.cashDelta.knownGames = 20
    player.metrics.seconds.knownGames = 20
    assert.deepEqual(statsCoverageLines(cs, "cs-CZ", player), [
        "Změnu cash, Odehraný čas známe z 20 z 23 her.",
    ])
    assert.deepEqual(
        statsCoverageLines(
            statsCopy("en"),
            "en-GB",
            exampleWardogsStats("x").player
        ),
        []
    )
})

test("the page preview follows the switches and the reply mode (N3-14)", () => {
    const access = getCommandMessages("cs").access
    const preview = statsPreviewView({
        language: "cs",
        locale: "cs-CZ",
        settings: {
            enabled: true,
            games: { hell_let_loose: true, wardogs: true },
        },
        reply: "privateShare",
        accessCopy: access,
        playerName: "Hráč 17",
    })
    const text = viewText(preview)
    assert.match(text, /WARDOGS · POSLEDNÍCH 30 DNÍ/)
    assert.match(text, /Zdroj: Warcon klanu · 23 her na serverech klanu$/m)
    assert.ok(viewButtons(preview).some((button) => button.label === "Sdílet"))
    const privateOnly = statsPreviewView({
        language: "cs",
        locale: "cs-CZ",
        settings: {
            enabled: true,
            games: { hell_let_loose: true, wardogs: true },
        },
        reply: "private",
        accessCopy: access,
        playerName: "Hráč 17",
    })
    assert.ok(
        !viewButtons(privateOnly).some((button) => button.label === "Sdílet")
    )
    assert.match(
        viewText(
            statsPreviewView({
                language: "cs",
                locale: "cs-CZ",
                settings: {
                    enabled: false,
                    games: { hell_let_loose: true, wardogs: true },
                },
                reply: "privateShare",
                accessCopy: access,
                playerName: "Hráč 17",
            })
        ),
        /Příkaz \/stats je tu vypnutý/
    )
    assert.match(
        viewText(
            statsPreviewView({
                language: "cs",
                locale: "cs-CZ",
                settings: {
                    enabled: true,
                    games: { hell_let_loose: true, wardogs: false },
                },
                reply: "privateShare",
                accessCopy: access,
                playerName: "Hráč 17",
            })
        ),
        /Statistiky Wardogs jsou tu vypnuté/
    )
})

test("every language has the same /stats copy keys", () => {
    const keys = (value: object): string[] =>
        Object.entries(value).flatMap(([key, entry]) =>
            entry && typeof entry === "object" && !("other" in entry)
                ? keys(entry).map((child) => `${key}.${child}`)
                : [key]
        )
    assert.deepEqual(keys(statsCopy("en")), keys(statsCopy("cs")))
    assert.deepEqual(keys(statsCopy("de")), keys(statsCopy("cs")))
})
