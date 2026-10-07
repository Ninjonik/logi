import { FIXTURE_PHASES, PANEL_WINDOW } from "./all-fixtures"
import { preparationChipSchema } from "./preparation.schema"
import { z } from "zod"

/**
 * The two self-updating WD League messages stacked in one channel (P6-06,
 * P6-13, owner decision): 1. "WD League · tabulka", 2. "WD League · nejbližší
 * zápasy" with the recent results under the fixtures. The board's third
 * message is folded into the second (INDEX "Superseded" table).
 *
 * This file holds the Zod view schemas (website parity); the constants,
 * keys and builders live in `panel-data.ts` and are re-exported here.
 */
export {
    buildFixturesView,
    buildStandingsView,
    DEFAULT_LEAGUE_PANEL_OPTIONS,
    DISCORD_MESSAGE_TEXT_LIMIT,
    fitWithinLimit,
    LEAGUE_LINKS,
    LEAGUE_PANEL_ORDER,
    LEAGUE_PANEL_REFRESH_MS,
    leagueDataAt,
    leaguePanelKey,
    leaguePanelOptionsOf,
    type LeaguePanelPart,
    type StoredLeagueFixture,
} from "./panel-data"
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
    /** The latest League page read; "Aktualizováno …" in the footer. */
    dataAt: iso.nullable(),
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
            /**
             * "waiting_for_results" until Logi has collected any League result
             * (INDEX resolution 7): the panel says so instead of claiming the
             * League had no results (P6-18).
             */
            state: z.enum(["waiting_for_results", "ready"]),
            from: iso,
            to: iso,
            items: z.array(leagueRecentResultViewSchema),
        })
        .nullable(),
    revision: z.number().int().nonnegative(),
    /** Some shown fixture is older than the shared cache or failed its last read. */
    stale: z.boolean(),
    /** The latest League page read; "Aktualizováno …" in the footer. */
    dataAt: iso.nullable(),
    links: z.object({ fixtures: z.url(), results: z.url() }),
})
export type LeagueFixturesView = z.infer<typeof leagueFixturesViewSchema>

/** Website parity of both panels (`GET /api/v1/clan/league-fixtures/overview`). */
export const leagueOverviewSchema = z.object({
    standings: leagueStandingsViewSchema,
    fixtures: leagueFixturesViewSchema,
})
export type LeagueOverview = z.infer<typeof leagueOverviewSchema>
