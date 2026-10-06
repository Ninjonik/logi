import assert from "node:assert/strict"
import test from "node:test"

import {
    fixturesPayload,
    humanLeagueInput,
    linkReplyPayload,
    standingsPayload,
    type LeagueRenderContext,
} from "./render"
import {
    buildFixturesView,
    buildStandingsView,
    DEFAULT_LEAGUE_PANEL_OPTIONS,
} from "../../../src/domain/wardogs-league/panels"
import {
    boardLeagueFixtures,
    boardLeagueResults,
} from "../../../src/infrastructure/testing/league-fixtures"

type Json = Record<string, unknown> & { components?: Json[] }
/** The payload as Discord receives it. */
const json = (payload: { components?: unknown }) =>
    (payload.components as { toJSON(): unknown }[]).map(
        (component) => JSON.parse(JSON.stringify(component.toJSON())) as Json
    )
/** Every text display of a payload, in order. */
function texts(components: Json[]): string[] {
    return components.flatMap((component) => [
        ...(typeof component.content === "string" ? [component.content] : []),
        ...texts(component.components ?? []),
    ])
}
/** Every button of a payload as [label, url]. */
function buttons(components: Json[]): Array<[string, string | undefined]> {
    return components.flatMap(
        (component) =>
            [
                ...(component.type === 2
                    ? [
                          [
                              String(component.label),
                              component.url as string | undefined,
                          ],
                      ]
                    : []),
                ...buttons(component.components ?? []),
            ] as Array<[string, string | undefined]>
    )
}

const now = Date.parse("2026-10-09T20:00:00.000Z")
const context = (
    overrides: Partial<LeagueRenderContext> = {}
): LeagueRenderContext => ({
    language: "cs",
    timeZone: "Europe/Prague",
    style: null,
    emoji: {},
    accentColor: null,
    paused: null,
    now,
    ...overrides,
})
const standings = (results = boardLeagueResults()) =>
    buildStandingsView(results, {
        now,
        ourTeamCodes: ["VLK"],
        revision: 1,
        dataAt: now - 60_000,
    })
const fixtures = (options = DEFAULT_LEAGUE_PANEL_OPTIONS) =>
    buildFixturesView(boardLeagueFixtures(now), boardLeagueResults(), {
        now,
        ourTeamCodes: ["VLK"],
        options,
        revision: 1,
        resultsCollected: true,
        dataAt: now - 60_000,
    })

test("before the first results the table says 'Tabulka se zobrazí po prvních výsledcích'", () => {
    const payload = json(standingsPayload(standings([]), context()))
    const all = texts(payload).join("\n")
    assert.match(all, /\*\*WARDOGS LEAGUE · SEZÓNA 2026\*\*/)
    assert.match(all, /### WD League · tabulka/)
    assert.match(all, /^body: 1\. místo 3 · 2\. místo 2 · 3\. místo 1$/m)
    assert.match(all, /^Tabulka se zobrazí po prvních výsledcích$/m)
    assert.doesNotMatch(all, /```/)
    assert.match(
        all,
        /-# Body počítá Logi z výsledků na wardogsleague\.net · Aktualizováno <t:\d+:R> · Spravováno v Logi/
    )
    assert.deepEqual(buttons(payload), [
        ["Otevřít ligu", "https://wardogsleague.net"],
    ])
    assert.equal(payload[0].accent_color, 0xe8a33d)
    // English and German say the same in the clan language.
    assert.match(
        texts(
            json(standingsPayload(standings([]), context({ language: "en" })))
        ).join("\n"),
        /The table appears after the first results/
    )
    assert.match(
        texts(
            json(standingsPayload(standings([]), context({ language: "de" })))
        ).join("\n"),
        /Die Tabelle erscheint nach den ersten Ergebnissen/
    )
})

test("the table is a code block with points after the code, our row marked and the legend", () => {
    const all = texts(json(standingsPayload(standings(), context()))).join("\n")
    assert.match(all, /^Po 5 zápasech · body: 1\. místo 3/m)
    assert.match(
        all,
        /```ansi\n #  Tým    B   Z  1\.  2\.  3\.  Název\n 1  ROG    6   2/
    )
    assert.match(
        all,
        /\u001b\[1;37m›2  VLK    5   2   1   1   0  Valkyria\u001b\[0m/
    )
    assert.match(
        all,
        / 2  BAMC   5   2   1   1   0  Batallón de Asalto, Manio…/
    )
    assert.match(
        all,
        /-# B body · Z zápasy · 1\. 2\. 3\. kolikrát na tom místě · › náš tým/
    )
})

test("nejbližší zápasy shows the board's fixtures, chips, links and the recent results", () => {
    const rendered = fixturesPayload(fixtures(), context(), { fixtures: true })
    const payload = json(rendered.payload)
    const all = texts(payload).join("\n")
    assert.match(all, /\*\*WARDOGS LEAGUE · ZÁPASY CELÉ LIGY\*\*/)
    assert.match(all, /### WD League · nejbližší zápasy/)
    assert.match(all, /^6 nejbližších zápasů · časy v tvém pásmu$/m)
    assert.match(
        all,
        /\*\*\\#38 · Friendly\*\*\n\*\*so <t:1791657000:d> · <t:1791657000:t>\*\* · <t:1791657000:R>/
    )
    assert.match(
        all,
        /› \*\*VLK\*\* \*\*Valkyria\*\* · CZE SVK · 48 členů · ◈ Valkyra/
    )
    assert.match(
        all,
        /\*\*BAMC\*\* Batallón de Asalto, Maniobra y Combate · ESP · 123 členů · ◈ Lonestar/
    )
    assert.match(all, /Zestafona · SmallFactory · DayLateGrayFog · Hostuje VLK/)
    assert.match(
        all,
        /⚪ \*\*Pravidla 0\/3\*\* · 🟡 \*\*Hlasování o mapě\*\* · končí <t:\d+:R> · ⚪ \*\*Moderátor zatím není\*\* · ⚪ \*\*Ready check nezačal\*\*/
    )
    assert.match(all, /Mapa po hlasování · Hostuje OSP/)
    assert.match(all, /🟡 \*\*Pravidla 2\/3\*\*.*🟢 \*\*Moderátor přidělen\*\*/)
    assert.match(
        all,
        /🟡 \*\*Pravidla 1\/3\*\* · ⚪ \*\*Hlasování o mapě nezačalo\*\*/
    )
    assert.equal(all.match(/⚪ \*\*Příprava ještě nezačala\*\*/g)?.length, 3)
    assert.match(all, /Mapa po hlasování · Hostuje MNT/)
    assert.equal(
        all.match(
            /\[Detail na wardogsleague\.net\]\(https:\/\/wardogsleague\.net\/matches\/f\d+\)/g
        )?.length,
        6
    )
    assert.match(all, /\*\*Poslední výsledky\*\* · 2\.–9\. 10\./)
    assert.match(
        all,
        /\*\*#37\*\* čt 8\. 10\. · League · 1\. BAMC  2\. OSP  3\. DEF/
    )
    assert.match(
        all,
        /\*\*#36\*\* st 7\. 10\. · Friendly · 1\. \*\*VLK\*\*  2\. MNT  3\. TRN/
    )
    assert.match(
        all,
        /-# Data z wardogsleague\.net · Aktualizováno <t:\d+:R> · obnovuje se každých 60 s · Spravováno v Logi/
    )
    assert.deepEqual(buttons(payload), [
        [
            "Všechny zápasy na webu ligy",
            "https://wardogsleague.net/matches?tab=fixtures",
        ],
        [
            "Výsledky na webu ligy",
            "https://wardogsleague.net/matches?tab=results",
        ],
    ])
})

test("before Logi collects League results the recent results wait instead of claiming none (P6-18)", () => {
    const view = (resultsCollected: boolean) =>
        buildFixturesView(boardLeagueFixtures(now), [], {
            now,
            ourTeamCodes: ["VLK"],
            options: DEFAULT_LEAGUE_PANEL_OPTIONS,
            revision: 1,
            resultsCollected,
            dataAt: now - 60_000,
        })
    const shown = (resultsCollected: boolean, language = "cs") =>
        texts(
            json(
                fixturesPayload(view(resultsCollected), context({ language }), {
                    fixtures: true,
                }).payload
            )
        ).join("\n")
    const waiting = shown(false)
    assert.match(waiting, /\*\*Poslední výsledky\*\* · 2\.–9\. 10\./)
    assert.match(waiting, /^Výsledky se zobrazí po prvních výsledcích ligy$/m)
    assert.doesNotMatch(waiting, /nejsou žádné výsledky/)
    assert.match(
        shown(false, "en"),
        /^Results appear after the first league results$/m
    )
    assert.match(
        shown(false, "de"),
        /^Die Ergebnisse erscheinen nach den ersten Liga-Ergebnissen$/m
    )
    // Once results are collected, a quiet week says so.
    assert.match(
        shown(true),
        /^Za posledních 7 dní nejsou žádné výsledky ligy\.$/m
    )
})

test("results alone are the board's 'WD League · poslední výsledky'", () => {
    const view = fixtures({ ...DEFAULT_LEAGUE_PANEL_OPTIONS, fixtures: false })
    const all = texts(
        json(fixturesPayload(view, context(), { fixtures: false }).payload)
    ).join("\n")
    assert.match(all, /\*\*WARDOGS LEAGUE · 2\.–9\. 10\.\*\*/)
    assert.match(all, /### WD League · poslední výsledky/)
    assert.match(
        all,
        /-# Body počítá Logi z výsledků na wardogsleague\.net · Aktualizováno/
    )
    assert.doesNotMatch(all, /obnovuje se/)
})

test("a paused panel keeps its content and link with 'Pozastaveno · správce zastavil obnovování' (L3-54)", () => {
    const rendered = fixturesPayload(
        fixtures(),
        context({ paused: { since: now - 3600_000 } }),
        { fixtures: true }
    )
    const payload = json(rendered.payload)
    const all = texts(payload).join("\n")
    assert.match(
        all,
        /🟡 \*\*Pozastaveno\*\* · správce zastavil obnovování · poslední data <t:\d+:f>/
    )
    assert.match(
        all,
        /-# Data z wardogsleague\.net · Aktualizováno <t:\d+:f> · Spravováno v Logi/
    )
    assert.doesNotMatch(all, /obnovuje se/)
    assert.match(all, /#38 · Friendly/)
    assert.equal(buttons(payload).length, 2)
    const table = texts(
        json(standingsPayload(standings(), context({ paused: { since: now } })))
    ).join("\n")
    assert.match(table, /Pozastaveno\*\* · správce zastavil obnovování/)
})

test("a League site that stopped answering shows a chip with the last data time", () => {
    const view = { ...fixtures(), stale: true }
    const all = texts(
        json(fixturesPayload(view, context(), { fixtures: true }).payload)
    ).join("\n")
    assert.match(
        all,
        /🟡 \*\*Web ligy neodpovídá\*\* · poslední data <t:\d+:R>/
    )
})

test("too many long fixtures stay within 4000 characters and say how many more are on the web", () => {
    const long = boardLeagueFixtures(now).map((fixture) => ({
        ...fixture,
        snapshot: {
            ...fixture.snapshot,
            teams: fixture.snapshot.teams!.map((team) => ({
                ...team,
                name: `${team.name} ${"x".repeat(150)}`,
            })),
        },
    }))
    const many = [
        ...long,
        ...long.map((fixture, index) => ({
            ...fixture,
            matchId: `g${index}`,
            snapshot: {
                ...fixture.snapshot,
                id: `g${index}`,
                sourceUrl: `https://wardogsleague.net/matches/g${index}`,
                fixtureNumber: 50 + index,
            },
        })),
    ]
    const view = buildFixturesView(many, boardLeagueResults(), {
        now,
        ourTeamCodes: ["VLK"],
        options: { ...DEFAULT_LEAGUE_PANEL_OPTIONS, fixtureCount: 10 },
        revision: 1,
        resultsCollected: true,
    })
    const rendered = fixturesPayload(view, context(), { fixtures: true })
    const all = texts(json(rendered.payload)).join("")
    assert.ok(all.length <= 4000, String(all.length))
    const shown = rendered.view.blocks.find((block) => block.kind === "fields")
    const count = shown?.kind === "fields" ? shown.items.length : 0
    assert.ok(count < 10)
    assert.match(
        texts(json(rendered.payload)).join("\n"),
        new RegExp(`… a (dalších|další) ${12 - count} zápas`)
    )
})

test("the link reply names the match, points to the panel and the League page (L3-56)", () => {
    const payload = json(
        linkReplyPayload(
            {
                matchId: "m41",
                sourceUrl: "https://wardogsleague.net/matches/m41",
                fixtureNumber: 41,
                teamCodes: ["VLK", "MNT", "DEF"],
                scheduledAt: "2026-10-24T18:00:00.000Z",
                panelChannelId: "100000000000000002",
                panelMessageUrl:
                    "https://discord.com/channels/1/100000000000000002/100000000000000003",
            },
            {
                language: "cs",
                timeZone: "Europe/Prague",
                style: null,
                accentColor: null,
            }
        )
    )
    const all = texts(payload).join("\n")
    assert.match(all, /\*\*WARDOGS LEAGUE · NOVÝ ZÁPAS 41\*\*/)
    assert.match(all, /### VLK vs MNT vs DEF/)
    assert.match(all, /^so <t:\d+:d> · <t:\d+:t> · <t:\d+:R>$/m)
    assert.match(
        all,
        /Logi zápas sleduje\. Kartu, která se sama obnovuje, najdeš v <#100000000000000002>\./
    )
    assert.match(all, /^-# Spravováno v Logi$/m)
    assert.doesNotMatch(all, /Aktualizováno/)
    assert.deepEqual(buttons(payload), [
        [
            "Otevřít kartu",
            "https://discord.com/channels/1/100000000000000002/100000000000000003",
        ],
        ["Otevřít na webu ligy", "https://wardogsleague.net/matches/m41"],
    ])
})

test("human intake rejects bots, webhooks, DMs and unconfigured rooms", () => {
    const source = {
        guildId: "guild",
        channelId: "room",
        bot: false,
        webhookId: null,
        content: "https://wardogsleague.net/matches/abc",
    }
    assert.deepEqual(humanLeagueInput(source, "room"), [
        "https://wardogsleague.net/matches/abc",
    ])
    assert.equal(humanLeagueInput({ ...source, bot: true }, "room"), null)
    assert.equal(
        humanLeagueInput({ ...source, webhookId: "hook" }, "room"),
        null
    )
    assert.equal(humanLeagueInput({ ...source, guildId: null }, "room"), null)
    assert.equal(humanLeagueInput(source, "other"), null)
})

test("received human edits remain available for backend receipt cleanup after intake moves or disables", () => {
    const edit = {
        guildId: "guild",
        channelId: "old-room",
        bot: false,
        webhookId: null,
        content: "Removed the link",
    }
    assert.deepEqual(humanLeagueInput(edit, "new-room", true), [])
    assert.deepEqual(humanLeagueInput(edit, null, true), [])
    assert.equal(humanLeagueInput(edit, "new-room"), null)
    assert.equal(humanLeagueInput({ ...edit, bot: true }, null, true), null)
    assert.equal(
        humanLeagueInput({ ...edit, webhookId: "hook" }, null, true),
        null
    )
})
