import { LEAGUE_POINTS_RULE, pointsForPlace, samePointsRule } from "./scoring"
import type { LeagueResultRecord } from "./results"

/**
 * One row of "WD League · tabulka" (P6-07..10): points ("B"), matches played
 * ("Z") and how often the team finished 1st, 2nd and 3rd.
 */
export type StandingRow = {
    rank: number
    teamCode: string
    teamName: string | null
    points: number
    played: number
    firsts: number
    seconds: number
    thirds: number
    /** The clan's own team; shown bold with "›" (P6-09, P6-B11). */
    ours: boolean
}

export type Standings = {
    season: string
    /** "Po 16 zápasech": results counted into the table. */
    matchesCounted: number
    /**
     * The rule every counted match used ("body: 1. místo 3 · 2. místo 2 ·
     * 3. místo 1"); null when counted matches published different rules.
     */
    pointsRule: number[] | null
    rows: StandingRow[]
}

/**
 * Computes the table of one season from League results (P6-02, P6-B03).
 *
 * Each placement earns the points of the rule published on its match page
 * (3, 2, 1 by default). Every match type the League publishes a rule for
 * counts, including friendlies, because the League awards points for them.
 *
 * Order (documented tie-breakers, the board only says "sorted by points"):
 * 1. more points; 2. more 1st places; 3. more 2nd places; 4. more 3rd places;
 * 5. fewer matches played. Teams equal on all five share the rank and are
 * listed by team code.
 */
export function computeStandings(
    results: readonly LeagueResultRecord[],
    input: { season: string; ourTeamCodes: readonly string[] }
): Standings {
    const byMatch = new Map<string, LeagueResultRecord>()
    for (const result of results)
        if (result.season === input.season) byMatch.set(result.matchId, result)
    const counted = [...byMatch.values()].sort(
        (a, b) =>
            Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
            a.matchId.localeCompare(b.matchId)
    )
    const ours = new Set(input.ourTeamCodes)
    const rows = new Map<string, Omit<StandingRow, "rank">>()
    for (const result of counted) {
        for (const entry of result.placements) {
            const row = rows.get(entry.teamCode) ?? {
                teamCode: entry.teamCode,
                teamName: null,
                points: 0,
                played: 0,
                firsts: 0,
                seconds: 0,
                thirds: 0,
                ours: ours.has(entry.teamCode),
            }
            row.points += pointsForPlace(result.pointsRule, entry.place)
            row.played += 1
            if (entry.place === 1) row.firsts += 1
            if (entry.place === 2) row.seconds += 1
            if (entry.place === 3) row.thirds += 1
            // Results are visited oldest first, so the newest known name wins.
            if (entry.teamName) row.teamName = entry.teamName
            rows.set(entry.teamCode, row)
        }
    }
    const sporting = (
        a: Omit<StandingRow, "rank">,
        b: Omit<StandingRow, "rank">
    ) =>
        b.points - a.points ||
        b.firsts - a.firsts ||
        b.seconds - a.seconds ||
        b.thirds - a.thirds ||
        a.played - b.played
    const ordered = [...rows.values()].sort(
        (a, b) =>
            sporting(a, b) ||
            (a.teamCode < b.teamCode ? -1 : a.teamCode > b.teamCode ? 1 : 0)
    )
    const ranked: StandingRow[] = []
    ordered.forEach((row, index) => {
        const previous = ranked[index - 1]
        ranked.push({
            ...row,
            rank:
                previous && sporting(previous, row) === 0
                    ? previous.rank
                    : index + 1,
        })
    })
    const rules = counted.map((result) => result.pointsRule)
    return {
        season: input.season,
        matchesCounted: counted.length,
        pointsRule: !rules.length
            ? [...LEAGUE_POINTS_RULE]
            : rules.every((rule) => samePointsRule(rule, rules[0]))
              ? [...rules[0]]
              : null,
        rows: ranked,
    }
}
