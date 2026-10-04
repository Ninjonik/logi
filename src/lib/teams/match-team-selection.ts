import {
    sortAssignments,
    type MatchTeamAssignment,
    type MatchTeamInput,
    type MatchTeamSlot,
} from "@/domain/teams/match-teams"
import { TEAM_GAMES, type TeamGame } from "@/domain/teams/team"
import type { GameId } from "@/domain/games/game"

/** The directory game a native match uses; a missing legacy game is HLL, HLL: Vietnam has none. */
export function matchTeamGame(gameId: GameId | undefined): TeamGame | null {
    const resolved = gameId ?? "hell_let_loose"
    return (TEAM_GAMES as readonly string[]).includes(resolved)
        ? (resolved as TeamGame)
        : null
}

/** Client input from stored assignments; snapshots stay server-owned. */
export function toMatchTeamInputs(
    assignments: readonly MatchTeamAssignment[] | undefined
): MatchTeamInput[] {
    return sortAssignments(assignments ?? []).map(({ teamId, slot, side }) => ({
        teamId,
        slot,
        side,
    }))
}

/** Places `teamId` in `slot`, keeping that slot's side; `null` empties the slot and its side. */
export function setSlotTeam(
    value: readonly MatchTeamInput[],
    slot: MatchTeamSlot,
    teamId: string | null
): MatchTeamInput[] {
    const current = value.find((entry) => entry.slot === slot)
    const others = value.filter((entry) => entry.slot !== slot)
    if (teamId === null) return sortAssignments(others)
    return sortAssignments([
        ...others,
        { teamId, slot, side: current?.side ?? null },
    ])
}

/** Changes the side of an occupied slot; an empty slot cannot hold a side. */
export function setSlotSide(
    value: readonly MatchTeamInput[],
    slot: MatchTeamSlot,
    side: string | null
): MatchTeamInput[] {
    return value.map((entry) =>
        entry.slot === slot ? { ...entry, side } : entry
    )
}

export type MatchTeamSelectionIssue = "duplicateTeam" | "duplicateSide"

/** Slots that repeat another slot's team or non-null side; a repeated team takes precedence. */
export function matchTeamSelectionIssues(
    value: readonly MatchTeamInput[]
): Partial<Record<MatchTeamSlot, MatchTeamSelectionIssue>> {
    const issues: Partial<Record<MatchTeamSlot, MatchTeamSelectionIssue>> = {}
    for (const entry of value) {
        const others = value.filter((other) => other.slot !== entry.slot)
        if (others.some((other) => other.teamId === entry.teamId))
            issues[entry.slot] = "duplicateTeam"
        else if (
            entry.side !== null &&
            others.some((other) => other.side === entry.side)
        )
            issues[entry.slot] = "duplicateSide"
    }
    return issues
}
