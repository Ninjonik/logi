import {
    buildFixturesView,
    buildStandingsView,
    leagueDataAt,
    type StoredLeagueFixture,
} from "../../domain/wardogs-league/panel-data"
import type {
    LeagueFixturesView,
    LeaguePanelOptions,
    LeagueStandingsView,
} from "../../domain/wardogs-league/panels"
import {
    leagueSeason,
    RECENT_RESULT_DAYS,
    type LeagueResultRecord,
} from "../../domain/wardogs-league/results"

/** Read side of the League-wide store, scoped to what the two panels show. */
export type LeaguePanelSource = {
    /** Live and upcoming fixtures (the store keeps them bounded). */
    openFixtures: () => Promise<StoredLeagueFixture[]>
    /** Results of one season, for the table. */
    seasonResults: (season: string) => Promise<LeagueResultRecord[]>
    /** Results dated at or after `since`, for "poslední výsledky". */
    resultsSince: (since: number) => Promise<LeagueResultRecord[]>
    /**
     * Highest change revision of the results and of the open fixtures. The
     * results revision stays 0 until the first League result is stored.
     */
    revisions: () => Promise<{ results: number; fixtures: number }>
}

export type LeaguePanels = {
    standings: LeagueStandingsView | null
    fixtures: LeagueFixturesView | null
}

/**
 * Builds the WD League panels for one guild. The data is the same for every
 * guild; only the highlighted team codes and the chosen content differ. A
 * panel whose content is switched off is null and is not posted.
 */
export async function loadLeaguePanels(
    source: LeaguePanelSource,
    input: {
        now: number
        ourTeamCodes: readonly string[]
        options: LeaguePanelOptions
    }
): Promise<LeaguePanels> {
    const season = leagueSeason(new Date(input.now).toISOString())
    const wantsFixtures = input.options.fixtures || input.options.recentResults
    if (!input.options.table && !wantsFixtures)
        return { standings: null, fixtures: null }
    const [revisions, seasonResults, recent, open] = await Promise.all([
        source.revisions(),
        input.options.table ? source.seasonResults(season) : [],
        input.options.recentResults
            ? source.resultsSince(input.now - RECENT_RESULT_DAYS * 86_400_000)
            : [],
        source.openFixtures(),
    ])
    // The footer's time: the latest League page read, whatever is shown.
    const dataAt = leagueDataAt(open)
    return {
        standings: input.options.table
            ? buildStandingsView(seasonResults, {
                  now: input.now,
                  ourTeamCodes: input.ourTeamCodes,
                  revision: revisions.results,
                  season,
                  dataAt,
              })
            : null,
        fixtures: wantsFixtures
            ? buildFixturesView(open, recent, {
                  now: input.now,
                  ourTeamCodes: input.ourTeamCodes,
                  options: input.options,
                  revision: Math.max(revisions.fixtures, revisions.results),
                  resultsCollected: revisions.results > 0,
                  dataAt,
              })
            : null,
    }
}
