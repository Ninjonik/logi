import { resolveClanOutcome } from "../discord-messages/match-result"
import { resultFaction } from "./result-sides"

type Participant = { id?: string; label: string; score: number | null }
type Team = {
    teamId: string
    side: string | null
    snapshot: { name: string; shortCode: string | null }
}
const normalized = (value: string | null | undefined) =>
    value?.trim().toLowerCase() || ""

/** Match identities, never scoreboard positions. Ambiguous identities stay unknown. */
export function participantForTeam(
    participants: readonly Participant[],
    team: Team
) {
    for (const identities of [
        [team.teamId],
        [team.side],
        [team.snapshot.name, team.snapshot.shortCode],
    ]) {
        const keys = identities.map(normalized).filter(Boolean)
        const matches = participants.filter(
            (p) =>
                keys.includes(normalized(p.id)) ||
                keys.includes(normalized(p.label))
        )
        if (matches.length) return matches.length === 1 ? matches[0] : undefined
    }
    const faction = resultFaction(team.side)
    const matches = faction
        ? participants.filter(
              (p) =>
                  resultFaction(p.id) === faction ||
                  resultFaction(p.label) === faction
          )
        : []
    return matches.length === 1 ? matches[0] : undefined
}

/** Shared by result pictures and the dashboard; unknown never means draw. */
export function resolveTeamResult(input: {
    participants: readonly Participant[]
    teams?: readonly Team[]
    ownTeam?: { id?: string; name: string; shortCode: string | null } | null
    clanName: string
    clanSide?: string | null
    imported?: Parameters<typeof resolveClanOutcome>[0]["imported"]
}) {
    const assignment = input.ownTeam?.id
        ? input.teams?.find((t) => t.teamId === input.ownTeam?.id)
        : undefined
    const side = assignment?.side || input.clanSide
    const own =
        (assignment && participantForTeam(input.participants, assignment)) ??
        participantForTeam(input.participants, {
            teamId: input.ownTeam?.id ?? "",
            side: side ?? null,
            snapshot: {
                name: input.ownTeam?.name || input.clanName,
                shortCode: input.ownTeam?.shortCode ?? null,
            },
        })
    return resolveClanOutcome({
        participants: input.participants,
        clanSide: own?.label,
        imported: input.imported,
    })
}
