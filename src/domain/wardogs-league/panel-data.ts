import type {
    LeagueFixturesView,
    LeagueFixtureView,
    LeaguePanelOptions,
    LeagueStandingsView,
} from "./panels"
import {
    leagueSeason,
    recentResults,
    RECENT_RESULT_DAYS,
    type LeagueResultRecord,
} from "./results"
import {
    nearestFixtures,
    PANEL_WINDOW,
    type FixturePhase,
} from "./all-fixtures"
import type { LeagueSnapshot } from "./contracts"
import { preparationChips } from "./preparation"
import { computeStandings } from "./standings"
import { INDEX_URLS } from "./discovery"

/**
 * The pure side of the two WD League panels: constants, keys, the view
 * builders and the message fitting. `panels.ts` keeps the Zod view schemas
 * (website parity) and re-exports everything here, so
 * `leagueDiscoveryPanels:forGuild`, which the bot reads every minute per
 * clan, never loads Zod (ARCHITECTURE.md, "Convex hot paths").
 */
export const LEAGUE_PANEL_REFRESH_MS = 60_000
/** Discord's text limit for one Components V2 message (P6-B05). */
export const DISCORD_MESSAGE_TEXT_LIMIT = 4000
/** The two messages of a WD League panel; the bot posts them once in this order, then edits (P6-B07). */
export const LEAGUE_PANEL_ORDER = ["standings", "fixtures"] as const
export type LeaguePanelPart = (typeof LEAGUE_PANEL_ORDER)[number]
/** Managed publication key of one message of a panel (`panel:<id>:…`, PANELS-API §1). */
export function leaguePanelKey(panelId: string, part: LeaguePanelPart) {
    return `panel:${panelId}:${part}`
}
export const LEAGUE_LINKS = {
    /** "Otevřít ligu". */
    league: "https://wardogsleague.net",
    /** "Všechny zápasy na webu ligy". */
    fixtures: INDEX_URLS[0],
    /** "Výsledky na webu ligy". */
    results: INDEX_URLS[1],
} as const

export const DEFAULT_LEAGUE_PANEL_OPTIONS: LeaguePanelOptions = {
    table: true,
    fixtures: true,
    recentResults: true,
    fixtureCount: 6,
}

/**
 * The options as a panel stores them, checked as the editor's schema would:
 * the fixture count is a whole number within the panel window. Anything else
 * is a configuration error, never a silent default.
 */
export function leaguePanelOptionsOf(
    value: LeaguePanelOptions
): LeaguePanelOptions {
    if (
        !Number.isInteger(value.fixtureCount) ||
        value.fixtureCount < 1 ||
        value.fixtureCount > PANEL_WINDOW
    )
        throw new Error("Invalid League panel options.")
    return {
        table: value.table,
        fixtures: value.fixtures,
        recentResults: value.recentResults,
        fixtureCount: value.fixtureCount,
    }
}

/** A fixture as the store keeps it, with freshness decided by the adapter. */
export type StoredLeagueFixture = {
    matchId: string
    phase: FixturePhase
    snapshot: LeagueSnapshot
    stale: boolean
    revision: number
}

const isoOrNull = (value: number | null | undefined) =>
    value === null || value === undefined || !Number.isFinite(value)
        ? null
        : new Date(value).toISOString()

/** The latest League page read among stored fixtures, for the footer. */
export function leagueDataAt(fixtures: readonly StoredLeagueFixture[]) {
    const times = fixtures
        .map((fixture) => Date.parse(fixture.snapshot.fetchedAt))
        .filter(Number.isFinite)
    return times.length ? Math.max(...times) : null
}

function fixtureView(
    fixture: StoredLeagueFixture,
    ours: Set<string>,
    now: number
): LeagueFixtureView {
    const snapshot = fixture.snapshot
    const teams = (snapshot.teams ?? []).map((team) => ({
        code: team.code,
        name: team.name,
        nations: team.nations,
        memberCount: team.displayedMemberCount,
        faction: team.faction,
        ours: ours.has(team.code),
    }))
    return {
        matchId: snapshot.id,
        sourceUrl: snapshot.sourceUrl,
        fixtureNumber: snapshot.fixtureNumber,
        type: snapshot.type,
        phase: fixture.phase,
        scheduledAt: snapshot.scheduledAt,
        teams,
        map: snapshot.map?.name
            ? {
                  name: snapshot.map.name,
                  zone: snapshot.map.zone,
                  lighting: snapshot.map.lighting,
              }
            : null,
        host:
            snapshot.hosting &&
            (snapshot.hosting.teamCode || snapshot.hosting.mode)
                ? {
                      teamCode: snapshot.hosting.teamCode,
                      mode: snapshot.hosting.mode,
                  }
                : null,
        preparation:
            fixture.phase === "upcoming" ? preparationChips(snapshot, now) : [],
        ours: teams.some((team) => team.ours),
        stale: fixture.stale,
        fetchedAt: snapshot.fetchedAt,
    }
}

/**
 * "WD League · tabulka" (P6-07..12). Until the first result of the season
 * exists the panel is in `waiting_for_results`
 * ("Tabulka se zobrazí po prvních výsledcích", INDEX resolution 7).
 */
export function buildStandingsView(
    results: readonly LeagueResultRecord[],
    input: {
        now: number
        ourTeamCodes: readonly string[]
        revision: number
        season?: string
        dataAt?: number | null
    }
): LeagueStandingsView {
    const season =
        input.season ?? leagueSeason(new Date(input.now).toISOString())
    const standings = computeStandings(results, {
        season,
        ourTeamCodes: input.ourTeamCodes,
    })
    // Built from stored, validated data; typed rather than re-parsed.
    return {
        kind: "standings",
        season,
        state: standings.matchesCounted ? "ready" : "waiting_for_results",
        matchesCounted: standings.matchesCounted,
        pointsRule: standings.pointsRule,
        rows: standings.rows,
        revision: input.revision,
        dataAt: isoOrNull(input.dataAt),
        links: { league: LEAGUE_LINKS.league },
    }
}

/**
 * "WD League · nejbližší zápasy" (P6-21..31) with "poslední výsledky"
 * (P6-17..20) folded in: the nearest `fixtureCount` fixtures of the whole
 * League with teams, map, host and preparation, then podiums of the last
 * seven days. `resultsCollected` says whether Logi has stored any League
 * result yet; until then the recent results wait instead of reading empty.
 */
export function buildFixturesView(
    fixtures: readonly StoredLeagueFixture[],
    results: readonly LeagueResultRecord[],
    input: {
        now: number
        ourTeamCodes: readonly string[]
        options: LeaguePanelOptions
        revision: number
        resultsCollected: boolean
        dataAt?: number | null
    }
): LeagueFixturesView {
    const ours = new Set(input.ourTeamCodes)
    const nearest = nearestFixtures(
        fixtures.map((fixture) => ({
            ...fixture,
            scheduledAt: fixture.snapshot.scheduledAt,
            fixtureNumber: fixture.snapshot.fixtureNumber,
        })),
        input.now,
        input.options.fixtures ? input.options.fixtureCount : 0
    )
    const shown = nearest.shown.map((fixture) =>
        fixtureView(fixture, ours, input.now)
    )
    const recent = recentResults(results, input.now)
    return {
        kind: "fixtures",
        fixtures: shown,
        hidden: input.options.fixtures ? nearest.hidden : 0,
        total: nearest.total,
        recentResults: input.options.recentResults
            ? {
                  state:
                      input.resultsCollected || recent.length
                          ? "ready"
                          : "waiting_for_results",
                  from: new Date(
                      input.now - RECENT_RESULT_DAYS * 86_400_000
                  ).toISOString(),
                  to: new Date(input.now).toISOString(),
                  items: recent.map((result) => ({
                      ...result,
                      podium: result.podium.map((entry) => ({
                          place: entry.place,
                          teamCode: entry.teamCode,
                          teamName: entry.teamName,
                          ours: ours.has(entry.teamCode),
                      })),
                  })),
              }
            : null,
        revision: input.revision,
        stale: shown.some((fixture) => fixture.stale),
        dataAt: isoOrNull(input.dataAt),
        links: {
            fixtures: LEAGUE_LINKS.fixtures,
            results: LEAGUE_LINKS.results,
        },
    }
}

/**
 * Keeps the leading items whose rendered message fits Discord's limit
 * (P6-B05): `measure` renders the message for the shown items and the count
 * of the ones left out, so the "how many more" line is part of the budget.
 */
export function fitWithinLimit<T>(
    items: readonly T[],
    measure: (shown: readonly T[], hidden: number) => number,
    limit = DISCORD_MESSAGE_TEXT_LIMIT,
    alreadyHidden = 0
): { shown: T[]; hidden: number } {
    for (let count = items.length; count >= 0; count--) {
        const shown = items.slice(0, count)
        const hidden = alreadyHidden + items.length - count
        if (measure(shown, hidden) <= limit) return { shown, hidden }
    }
    return { shown: [], hidden: alreadyHidden + items.length }
}
