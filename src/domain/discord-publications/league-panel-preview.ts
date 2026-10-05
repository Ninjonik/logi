import {
    escapeMarkdownText,
    panelFrame,
    type MessageBlock,
    type MessageView,
} from "../discord-messages/message-view"
import type {
    LeagueFixturesView,
    LeaguePanelOptions,
    LeagueStandingsView,
} from "../wardogs-league/panels"
import type { PreparationChip } from "../wardogs-league/preparation"
import { discordWeekdayTimestamp } from "../discord-messages/format"
import { factionEmblem } from "../discord-messages/faction-emblem"
import { PANEL_REFRESH_SECONDS } from "./settings"
import { shortDate } from "./result-panel"

/**
 * Editor preview of the two WD League messages (P2-54, P2-55): "WD League ·
 * tabulka" and "WD League · nejbližší zápasy" with the recent results, drawn
 * with the shared panel frame from the League's current data.
 *
 * Hand-off: the bot's League renderer belongs to the WD League workstream.
 * When it exports its own view builders for these two messages, the editor
 * should call them instead of this module so the preview stays the exact
 * message; until then this follows the board copy.
 */

type LeaguePreviewCopy = {
    tableLabel: string
    fixturesLabel: string
    season: (season: string) => string
    counted: (count: number) => string
    waiting: string
    moreTeams: (count: number) => string
    fullTable: string
    pointsRule: string
    thisWeek: string
    nearest: string
    noFixtures: string
    moreFixtures: (count: number) => string
    recentResults: string
    noRecentResults: string
    hosts: (team: string) => string
    mapVote: string
    preparation: (text: string) => string
    prep: {
        rules: (picked: number | null, total: number | null) => string
        mapVote: string
        moderator: (done: boolean) => string
        readyCheck: (done: boolean) => string
        notStarted: string
        ready: string
    }
    openWeb: string
    source: string
}

const CS: LeaguePreviewCopy = {
    tableLabel: "WD League · Tabulka",
    fixturesLabel: "WD League · Nejbližší zápasy",
    season: (season) => `Sezóna ${season}`,
    counted: (count) => `po ${count} ${count === 1 ? "zápasu" : "zápasech"}`,
    waiting: "Tabulka se zobrazí po prvních výsledcích.",
    moreTeams: (count) =>
        `… a ${count === 1 ? "další 1 tým" : count < 5 ? `další ${count} týmy` : `dalších ${count} týmů`}`,
    fullTable: "Celá tabulka",
    pointsRule: "Body podle pravidel ligy",
    thisWeek: "Tento týden",
    nearest: "Nejbližší zápasy",
    noFixtures: "Liga teď nemá naplánované zápasy.",
    moreFixtures: (count) =>
        `… a ${count === 1 ? "další 1 zápas" : count < 5 ? `další ${count} zápasy` : `dalších ${count} zápasů`}`,
    recentResults: "Poslední výsledky",
    noRecentResults: "Za poslední týden žádné výsledky.",
    hosts: (team) => `hostí ${team}`,
    mapVote: "mapa po hlasování",
    preparation: (text) => `Příprava: ${text}`,
    prep: {
        rules: (picked, total) =>
            picked !== null && total !== null
                ? `pravidla ${picked} ze ${total}`
                : "pravidla",
        mapVote: "hlasování o mapě",
        moderator: (done) =>
            done ? "moderátor přidělen" : "moderátor zatím není",
        readyCheck: (done) => (done ? "ready check hotový" : "ready check"),
        notStarted: "ještě nezačala",
        ready: "připraveno",
    },
    openWeb: "Otevřít na webu ligy",
    source: "Zdroj wardogsleague.net",
}

const EN: LeaguePreviewCopy = {
    tableLabel: "WD League · Table",
    fixturesLabel: "WD League · Next matches",
    season: (season) => `Season ${season}`,
    counted: (count) => `after ${count} ${count === 1 ? "match" : "matches"}`,
    waiting: "The table appears after the first results.",
    moreTeams: (count) =>
        `… and ${count} more ${count === 1 ? "team" : "teams"}`,
    fullTable: "Full table",
    pointsRule: "Points by the league rules",
    thisWeek: "This week",
    nearest: "Next matches",
    noFixtures: "The league has no matches planned right now.",
    moreFixtures: (count) =>
        `… and ${count} more ${count === 1 ? "match" : "matches"}`,
    recentResults: "Recent results",
    noRecentResults: "No results in the last week.",
    hosts: (team) => `hosted by ${team}`,
    mapVote: "map after the vote",
    preparation: (text) => `Preparation: ${text}`,
    prep: {
        rules: (picked, total) =>
            picked !== null && total !== null
                ? `rules ${picked} of ${total}`
                : "rules",
        mapVote: "map vote",
        moderator: (done) => (done ? "moderator assigned" : "no moderator yet"),
        readyCheck: (done) => (done ? "ready check done" : "ready check"),
        notStarted: "not started yet",
        ready: "ready",
    },
    openWeb: "Open on the league website",
    source: "Source wardogsleague.net",
}

const DE: LeaguePreviewCopy = {
    tableLabel: "WD League · Tabelle",
    fixturesLabel: "WD League · Nächste Spiele",
    season: (season) => `Saison ${season}`,
    counted: (count) => `nach ${count} ${count === 1 ? "Spiel" : "Spielen"}`,
    waiting: "Die Tabelle erscheint nach den ersten Ergebnissen.",
    moreTeams: (count) =>
        `… und ${count} ${count === 1 ? "weiteres Team" : "weitere Teams"}`,
    fullTable: "Ganze Tabelle",
    pointsRule: "Punkte nach den Ligaregeln",
    thisWeek: "Diese Woche",
    nearest: "Nächste Spiele",
    noFixtures: "Die Liga hat gerade keine Spiele geplant.",
    moreFixtures: (count) =>
        `… und ${count} ${count === 1 ? "weiteres Spiel" : "weitere Spiele"}`,
    recentResults: "Letzte Ergebnisse",
    noRecentResults: "Keine Ergebnisse in der letzten Woche.",
    hosts: (team) => `Gastgeber ${team}`,
    mapVote: "Karte nach der Abstimmung",
    preparation: (text) => `Vorbereitung: ${text}`,
    prep: {
        rules: (picked, total) =>
            picked !== null && total !== null
                ? `Regeln ${picked} von ${total}`
                : "Regeln",
        mapVote: "Kartenabstimmung",
        moderator: (done) =>
            done ? "Moderator zugeteilt" : "noch kein Moderator",
        readyCheck: (done) => (done ? "Ready-Check fertig" : "Ready-Check"),
        notStarted: "noch nicht begonnen",
        ready: "bereit",
    },
    openWeb: "Auf der Liga-Website öffnen",
    source: "Quelle wardogsleague.net",
}

const COPY: Record<string, LeaguePreviewCopy> = { cs: CS, en: EN, de: DE }
const LOCALES: Record<string, string> = {
    cs: "cs-CZ",
    en: "en-GB",
    de: "de-DE",
}

/** The board shows the top of the table; the rest is one line (P2-54). */
export const LEAGUE_PREVIEW_TABLE_ROWS = 4
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function preparationText(
    chips: readonly PreparationChip[],
    copy: LeaguePreviewCopy
) {
    if (!chips.length) return null
    if (chips.every((chip) => chip.tone === "done")) return copy.prep.ready
    const open = chips.find((chip) => chip.tone !== "done") ?? chips[0]!
    switch (open.kind) {
        case "rules":
            return copy.prep.rules(open.picked, open.total)
        case "mapVote":
            return copy.prep.mapVote
        case "moderator":
            return copy.prep.moderator(open.tone === "done")
        case "readyCheck":
            return copy.prep.readyCheck(open.tone === "done")
        case "notStarted":
            return copy.prep.notStarted
    }
}

const teamCode = (code: string) => `\`${code.replace(/`/g, "ˋ")}\``

export function leagueStandingsPreview(input: {
    view: LeagueStandingsView
    language: string
    accentColor: string | null
    now: number
}): MessageView {
    const copy = COPY[input.language] ?? EN
    const { view } = input
    const content: MessageBlock[] = []
    if (view.state === "waiting_for_results" || !view.rows.length)
        content.push({ kind: "text", markdown: copy.waiting })
    else {
        const shown = view.rows.slice(0, LEAGUE_PREVIEW_TABLE_ROWS)
        content.push({
            kind: "text",
            markdown: shown
                .map((row) => {
                    const name = row.teamName
                        ? ` ${escapeMarkdownText(row.teamName)}`
                        : ""
                    const line = `${row.rank}. ${teamCode(row.teamCode)}${name} · **${row.points}**`
                    return row.ours ? `**${line.replace(/\*\*/g, "")}**` : line
                })
                .join("\n"),
        })
        const hidden = view.rows.length - shown.length
        if (hidden > 0)
            content.push({ kind: "text", markdown: copy.moreTeams(hidden) })
    }
    return panelFrame({
        accentColor: input.accentColor,
        label: copy.tableLabel,
        title:
            view.state === "ready"
                ? `${copy.season(view.season)} · ${copy.counted(view.matchesCounted)}`
                : copy.season(view.season),
        content,
        actions: [
            [{ kind: "link", url: view.links.league, label: copy.fullTable }],
        ],
        footerNotes: [copy.pointsRule],
        updatedAt: input.now,
        refreshSeconds: PANEL_REFRESH_SECONDS,
    })
}

export function leagueFixturesPreview(input: {
    view: LeagueFixturesView
    language: string
    timeZone: string
    accentColor: string | null
    now: number
}): MessageView {
    const copy = COPY[input.language] ?? EN
    const locale = LOCALES[input.language] ?? "en-GB"
    const { view } = input
    const content: MessageBlock[] = []
    if (!view.fixtures.length && view.recentResults === null)
        content.push({ kind: "text", markdown: copy.noFixtures })
    view.fixtures.forEach((fixture, index) => {
        if (index > 0)
            content.push({ kind: "separator", divider: true, spacing: "small" })
        const teams = fixture.teams
            .map((team) => {
                const faction = team.faction
                const sign = faction ? factionEmblem(faction) : undefined
                return [
                    teamCode(team.code),
                    sign,
                    faction ? escapeMarkdownText(faction) : null,
                ]
                    .filter(Boolean)
                    .join(" ")
            })
            .join(" · ")
        const when = fixture.scheduledAt
            ? discordWeekdayTimestamp(
                  fixture.scheduledAt,
                  locale,
                  input.timeZone
              )
            : null
        const relative = fixture.scheduledAt
            ? `<t:${Math.floor(Date.parse(fixture.scheduledAt) / 1000)}:R>`
            : null
        const details = [
            when,
            relative,
            fixture.map ? escapeMarkdownText(fixture.map.name) : copy.mapVote,
            fixture.host?.teamCode ? copy.hosts(fixture.host.teamCode) : null,
        ]
            .filter(Boolean)
            .join(" · ")
        const prep = preparationText(fixture.preparation, copy)
        content.push({
            kind: "text",
            markdown: [teams, details, prep ? copy.preparation(prep) : null]
                .filter(Boolean)
                .join("\n"),
        })
    })
    if (view.hidden > 0)
        content.push({ kind: "text", markdown: copy.moreFixtures(view.hidden) })
    if (view.recentResults) {
        const items = view.recentResults.items
        content.push({
            kind: "text",
            markdown: [
                `**${copy.recentResults.toLocaleUpperCase(locale)}**`,
                ...(items.length
                    ? items.map((result) => {
                          const podium = [...result.podium]
                              .sort((a, b) => a.place - b.place)
                              .map(
                                  (entry) => `${entry.teamCode} ${entry.place}.`
                              )
                              .join(" · ")
                          const date = shortDate(
                              result.occurredAt,
                              locale,
                              input.timeZone
                          )
                          return `${podium}${date ? `  (${date})` : ""}`
                      })
                    : [copy.noRecentResults]),
            ].join("\n"),
        })
    }
    const first = view.fixtures[0]?.scheduledAt
    const soon = first ? Date.parse(first) - input.now <= WEEK_MS : false
    return panelFrame({
        accentColor: input.accentColor,
        label: copy.fixturesLabel,
        title: soon ? copy.thisWeek : copy.nearest,
        content,
        actions: [
            [
                {
                    kind: "link",
                    url: view.links.fixtures,
                    label: copy.openWeb,
                },
            ],
        ],
        footerNotes: [copy.source],
        updatedAt: input.now,
        refreshSeconds: PANEL_REFRESH_SECONDS,
    })
}

/** The messages a WD League panel posts with its chosen content, in order. */
export function leaguePanelPreviews(input: {
    standings: LeagueStandingsView | null
    fixtures: LeagueFixturesView | null
    options: LeaguePanelOptions
    language: string
    timeZone: string
    accentColor: string | null
    now: number
}): MessageView[] {
    const views: MessageView[] = []
    if (input.options.table && input.standings)
        views.push(
            leagueStandingsPreview({
                view: input.standings,
                language: input.language,
                accentColor: input.accentColor,
                now: input.now,
            })
        )
    if (
        (input.options.fixtures || input.options.recentResults) &&
        input.fixtures
    ) {
        const fixtures = input.options.fixtures
            ? {
                  ...input.fixtures,
                  hidden:
                      input.fixtures.hidden +
                      Math.max(
                          0,
                          input.fixtures.fixtures.length -
                              input.options.fixtureCount
                      ),
                  fixtures: input.fixtures.fixtures.slice(
                      0,
                      input.options.fixtureCount
                  ),
              }
            : { ...input.fixtures, fixtures: [], hidden: 0 }
        views.push(
            leagueFixturesPreview({
                view: {
                    ...fixtures,
                    recentResults: input.options.recentResults
                        ? fixtures.recentResults
                        : null,
                },
                language: input.language,
                timeZone: input.timeZone,
                accentColor: input.accentColor,
                now: input.now,
            })
        )
    }
    return views
}
