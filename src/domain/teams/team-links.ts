import { TEAM_SEARCH_MAX, type TeamGame } from "./team"

/**
 * Links into a clan's Týmy page (board L5-39..40, L2-57). The catalogue
 * has no page per team, so "Otevřít tým v Logi" opens the clan's list for
 * the team's game, already searched for that team.
 */

/** The query parameter that pre-fills the catalogue search. */
export const TEAM_SEARCH_PARAM = "search"

/** The search a link asks for: one trimmed value, bounded like the field. */
export function teamSearchParam(value: string | string[] | undefined) {
    return typeof value === "string"
        ? value.trim().slice(0, TEAM_SEARCH_MAX)
        : ""
}

/**
 * "/cs/dashboard/servers/<id>/teams?game=hell_let_loose&search=Vlci": the
 * clan's Týmy page for one game, searched for `team` when given.
 */
export function clanTeamsPath(input: {
    language: string
    serverId: string
    gameId: TeamGame
    team?: string | null
}) {
    const query = new URLSearchParams({ game: input.gameId })
    const search = teamSearchParam(input.team ?? undefined)
    if (search) query.set(TEAM_SEARCH_PARAM, search)
    return `/${input.language}/dashboard/servers/${encodeURIComponent(input.serverId)}/teams?${query.toString()}`
}
