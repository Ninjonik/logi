import type { TeamRequestRecord } from "@/domain/teams/team-request"
import type { TeamGame } from "@/domain/teams/team"

export type RequestFilters = { game: TeamGame | "all"; clan: string | "all" }

/** Compact game names for list rows (design I2: "HLL · před 2 h"). */
export const TEAM_GAME_SHORT_LABELS: Record<TeamGame, string> = {
    hell_let_loose: "HLL",
    wardogs: "Wardogs",
}

/** The loaded requests that match the game and clan filters, in queue order. */
export function filterTeamRequests(
    items: readonly TeamRequestRecord[],
    filters: RequestFilters
): TeamRequestRecord[] {
    return items.filter(
        (request) =>
            (filters.game === "all" || request.gameId === filters.game) &&
            (filters.clan === "all" || request.guildId === filters.clan)
    )
}

/** Clans that sent the loaded requests, once each, by name. */
export function requestClanOptions(
    items: readonly TeamRequestRecord[]
): Array<{ id: string; name: string | null }> {
    const clans = new Map<string, string | null>()
    for (const request of items)
        if (!clans.has(request.guildId) || request.workspaceName)
            clans.set(request.guildId, request.workspaceName)
    return [...clans]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id))
}

/** The request to show: the chosen one while it is listed, otherwise the first. */
export function selectedTeamRequest(
    visible: readonly TeamRequestRecord[],
    selectedId: string | null
): TeamRequestRecord | null {
    return (
        visible.find((request) => request.id === selectedId) ??
        visible[0] ??
        null
    )
}
