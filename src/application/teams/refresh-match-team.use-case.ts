import {
    matchTeamsEditability,
    refreshMatchTeamSnapshot,
    type MatchTeamAssignment,
    type MatchTeamError,
} from "../../domain/teams/match-teams"
import type { EventKind, EventStatus } from "../../domain/events/types"
import { currentEventStatus } from "../../domain/events/status"
import { teamGameSchema } from "../../domain/teams/team"
import type { MatchTeamSnapshotPorts } from "./ports"

/** The event facts a refresh decides on. */
export type RefreshableEvent = {
    id: string
    gameId?: string
    kind?: EventKind
    status?: EventStatus
    registrationEnd?: string
    meetingStart?: string
    gameEnd?: string
    matchTeams?: MatchTeamAssignment[]
}

/**
 * Explicit, audited re-capture of one assigned team's presentation from its
 * active directory entry, until the match concludes by its schedule-derived
 * status. A rejection writes nothing. Shared by the dashboard refresh and the
 * website `refresh_match_team` command.
 */
export async function refreshAssignedMatchTeam(
    ports: MatchTeamSnapshotPorts,
    input: {
        guildId: string
        event: RefreshableEvent
        teamId: string
        actor: string
        now: Date
    }
): Promise<
    | { ok: true; matchTeams: MatchTeamAssignment[] }
    | { ok: false; error: MatchTeamError }
> {
    const { event } = input
    const frozen = matchTeamsEditability({
        kind: event.kind,
        status: currentEventStatus(event, input.now),
    })
    if (frozen) return { ok: false, error: frozen }
    const game = teamGameSchema.safeParse(event.gameId ?? "hell_let_loose")
    if (!game.success) return { ok: false, error: "team_game_mismatch" }
    const assignment = event.matchTeams?.find(
        (entry) => entry.teamId === input.teamId
    )
    if (!event.matchTeams || !assignment)
        return { ok: false, error: "team_not_found" }
    const now = input.now.toISOString()
    const refreshed = refreshMatchTeamSnapshot({
        guildId: input.guildId,
        gameId: game.data,
        assignment,
        team: await ports.lookupTeam(input.teamId),
        now,
    })
    if (!refreshed.ok) return refreshed
    const matchTeams = event.matchTeams.map((entry) =>
        entry.teamId === input.teamId ? refreshed.assignment : entry
    )
    await ports.saveAssignments(event.id, matchTeams, now)
    await ports.auditRefresh(input.guildId, input.teamId, input.actor, event.id)
    return { ok: true, matchTeams }
}
