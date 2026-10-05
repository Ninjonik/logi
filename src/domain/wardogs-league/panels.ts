import {
    leagueSeason,
    recentResults,
    RECENT_RESULT_DAYS,
    type LeagueResultRecord,
} from "./results"
import {
    nearestFixtures,
    FIXTURE_PHASES,
    PANEL_WINDOW,
    type FixturePhase,
} from "./all-fixtures"
import { preparationChips, preparationChipSchema } from "./preparation"
import { leagueSnapshotSchema, type LeagueSnapshot } from "./contracts"
import { computeStandings } from "./standings"
import { INDEX_URLS } from "./discovery"
import { z } from "zod"

/**
 * The two self-updating WD League messages stacked in one channel (P6-06,
 * P6-13, owner decision): 1. "WD League · tabulka", 2. "WD League · nejbližší
 * zápasy" with the recent results under the fixtures. The board's third
 * message is folded into the second (INDEX "Superseded" table).
 */
export const LEAGUE_PANEL_REFRESH_MS = 60_000
/** Discord's text limit for one Components V2 message (P6-B05). */
export const DISCORD_MESSAGE_TEXT_LIMIT = 4000
/** Managed publication keys; the bot posts them once in this order, then edits (P6-B07). */
export const LEAGUE_PANEL_KEYS = {
    standings: "league-panel:standings",
    fixtures: "league-panel:fixtures",
} as const
export const LEAGUE_PANEL_ORDER = ["standings", "fixtures"] as const
export const LEAGUE_LINKS = {
    /** "Otevřít ligu". */
    league: "https://wardogsleague.net",
    /** "Všechny zápasy na webu ligy". */
    fixtures: INDEX_URLS[0],
    /** "Výsledky na webu ligy". */
    results: INDEX_URLS[1],
} as const

/** Panel content chosen in the editor (P2-51, P2-B15): defaults all on, six fixtures. */
export const leaguePanelOptionsSchema = z
    .object({
        table: z.boolean(),
        fixtures: z.boolean(),
        recentResults: z.boolean(),
        fixtureCount: z.number().int().min(1).max(PANEL_WINDOW),
    })
    .strict()
export type LeaguePanelOptions = z.infer<typeof leaguePanelOptionsSchema>
export const DEFAULT_LEAGUE_PANEL_OPTIONS: LeaguePanelOptions = {
    table: true,
    fixtures: true,
    recentResults: true,
    fixtureCount: 6,
}

const text = z.string().min(1).max(500)
const iso = z.iso.datetime()
const teamViewSchema = z.object({
    code: text,
    name: text.nullable(),
    nations: z.array(text).nullable(),
    memberCount: z.number().int().nonnegative().nullable(),
    faction: text.nullable(),
    ours: z.boolean(),
})
export const leagueFixtureViewSchema = z.object({
    matchId: text,
    sourceUrl: z.url(),
    fixtureNumber: z.number().int().nonnegative().nullable(),
    type: text.nullable(),
    phase: z.enum(FIXTURE_PHASES),
    scheduledAt: iso.nullable(),
    teams: z.array(teamViewSchema),
    /** Null: "Mapa po hlasování"; the bot looks up map art by `name` (P6-24). */
    map: z
        .object({
            name: text,
            zone: text.nullable(),
            lighting: text.nullable(),
        })
        .nullable(),
    /** "Hostuje VLK". */
    host: z
        .object({ teamCode: text.nullable(), mode: text.nullable() })
        .nullable(),
    preparation: z.array(preparationChipSchema),
    ours: z.boolean(),
    stale: z.boolean(),
    fetchedAt: iso,
})
export type LeagueFixtureView = z.infer<typeof leagueFixtureViewSchema>

export const leagueStandingRowSchema = z.object({
    rank: z.number().int().min(1),
    teamCode: text,
    teamName: text.nullable(),
    points: z.number().int().nonnegative(),
    played: z.number().int().nonnegative(),
    firsts: z.number().int().nonnegative(),
    seconds: z.number().int().nonnegative(),
    thirds: z.number().int().nonnegative(),
    ours: z.boolean(),
})
export const leagueStandingsViewSchema = z.object({
    kind: z.literal("standings"),
    season: z.string().regex(/^\d{4}$/),
    /** "waiting_for_results": "Tabulka se zobrazí po prvních výsledcích". */
    state: z.enum(["waiting_for_results", "ready"]),
    matchesCounted: z.number().int().nonnegative(),
    pointsRule: z.array(z.number().int().nonnegative()).nullable(),
    rows: z.array(leagueStandingRowSchema),
    revision: z.number().int().nonnegative(),
    links: z.object({ league: z.url() }),
})
export type LeagueStandingsView = z.infer<typeof leagueStandingsViewSchema>

export const leagueRecentResultViewSchema = z.object({
    matchId: text,
    sourceUrl: z.url(),
    fixtureNumber: z.number().int().nonnegative().nullable(),
    type: text.nullable(),
    occurredAt: iso,
    podium: z.array(
        z.object({
            place: z.number().int().min(1).max(3),
            teamCode: text,
            teamName: text.nullable(),
            ours: z.boolean(),
        })
    ),
})
export const leagueFixturesViewSchema = z.object({
    kind: z.literal("fixtures"),
    fixtures: z.array(leagueFixtureViewSchema),
    /** Upcoming fixtures not shown ("… a další 4 zápasy" / count on the web). */
    hidden: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    /** Null when the panel option "Poslední výsledky" is off. */
    recentResults: z
        .object({
            from: iso,
            to: iso,
            items: z.array(leagueRecentResultViewSchema),
        })
        .nullable(),
    revision: z.number().int().nonnegative(),
    /** Some shown fixture is older than the shared cache or failed its last read. */
    stale: z.boolean(),
    links: z.object({ fixtures: z.url(), results: z.url() }),
})
export type LeagueFixturesView = z.infer<typeof leagueFixturesViewSchema>

/** Website parity of both panels (`GET /api/v1/clan/league-fixtures/overview`). */
export const leagueOverviewSchema = z.object({
    standings: leagueStandingsViewSchema,
    fixtures: leagueFixturesViewSchema,
})
export type LeagueOverview = z.infer<typeof leagueOverviewSchema>

/** A fixture as the store keeps it, with freshness decided by the adapter. */
export type StoredLeagueFixture = {
    matchId: string
    phase: FixturePhase
    snapshot: LeagueSnapshot
    stale: boolean
    revision: number
}

function fixtureView(
    fixture: StoredLeagueFixture,
    ours: Set<string>,
    now: number
): LeagueFixtureView {
    const snapshot = leagueSnapshotSchema.parse(fixture.snapshot)
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
    }
): LeagueStandingsView {
    const season =
        input.season ?? leagueSeason(new Date(input.now).toISOString())
    const standings = computeStandings(results, {
        season,
        ourTeamCodes: input.ourTeamCodes,
    })
    return leagueStandingsViewSchema.parse({
        kind: "standings",
        season,
        state: standings.matchesCounted ? "ready" : "waiting_for_results",
        matchesCounted: standings.matchesCounted,
        pointsRule: standings.pointsRule,
        rows: standings.rows,
        revision: input.revision,
        links: { league: LEAGUE_LINKS.league },
    })
}

/**
 * "WD League · nejbližší zápasy" (P6-21..31) with "poslední výsledky"
 * (P6-17..20) folded in: the nearest `fixtureCount` fixtures of the whole
 * League with teams, map, host and preparation, then podiums of the last
 * seven days.
 */
export function buildFixturesView(
    fixtures: readonly StoredLeagueFixture[],
    results: readonly LeagueResultRecord[],
    input: {
        now: number
        ourTeamCodes: readonly string[]
        options: LeaguePanelOptions
        revision: number
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
    return leagueFixturesViewSchema.parse({
        kind: "fixtures",
        fixtures: shown,
        hidden: input.options.fixtures ? nearest.hidden : 0,
        total: nearest.total,
        recentResults: input.options.recentResults
            ? {
                  from: new Date(
                      input.now - RECENT_RESULT_DAYS * 86_400_000
                  ).toISOString(),
                  to: new Date(input.now).toISOString(),
                  items: recentResults(results, input.now).map((result) => ({
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
        links: {
            fixtures: LEAGUE_LINKS.fixtures,
            results: LEAGUE_LINKS.results,
        },
    })
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
