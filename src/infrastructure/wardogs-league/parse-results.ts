import type {
    LeagueMatch,
    LeagueResults,
} from "../../domain/wardogs-league/contracts"
// Type-only; the runtime parsers load through `cheerio/slim` (htmlparser2).
import type { CheerioAPI } from "cheerio/slim"

/**
 * Identifies what this file can read. The League-wide collector stores it
 * with every read and re-reads completed fixtures without placements once
 * when it changes, so a new parser backfills results it could not read
 * before. Change it together with `parseLeagueResults`.
 */
export const RESULTS_PARSER_ID = "none/1"

/**
 * Finishing places of a completed League match page.
 *
 * Not implemented yet, on purpose: the only captured page
 * (`fixtures/scheduled.html`) is a Scheduled fixture. Its "Placements 0/3"
 * and "Confirmed" progress steps prove that placements exist on the site,
 * but not how a finished page lists them, and wardogsleague.net cannot be
 * reached from the development sandbox. Inventing markup would publish
 * guessed standings, so this returns `null` with the warning
 * `results_not_supported` and every consumer treats results as unknown.
 *
 * Adding the parser is a change to this file only (plus its test):
 * 1. Capture anonymously, as `fixtures/completed.html` with provenance in
 *    `fixtures/README.md`, a page whose header says "Completed" (or
 *    "Confirmed") and whose progress shows "Placements 3/3"; ideally a second
 *    capture before the "Confirmed" step and one with a no-show or tie.
 * 2. Read each team's place from that page's own semantic structure (for
 *    example a placements list or the line-up order with place labels), bind
 *    places to team codes from the team profile links already parsed into
 *    `context.teams`, and set `confirmed` from the "Confirmed" progress step.
 * 3. Return `{ results, warnings: [] }`; keep returning null with a warning
 *    for any page whose placements do not match the captured structure.
 * 4. Change `RESULTS_PARSER_ID`.
 * The result shape is validated by `leagueResultsSchema`; the store, table,
 * recent results, panels and API already handle non-null results.
 */
export function parseLeagueResults(
    $: CheerioAPI,
    context: Pick<LeagueMatch, "teams" | "progress" | "status">
): { results: LeagueResults | null; warnings: string[] } {
    void $
    void context
    return { results: null, warnings: ["results_not_supported"] }
}
