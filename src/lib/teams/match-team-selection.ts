import { TEAM_GAMES, type TeamGame } from "@/domain/teams/team"
import type { GameId } from "@/domain/games/game"

/** The directory game a native match uses; a missing legacy game is HLL, HLL: Vietnam has none. */
export function matchTeamGame(gameId: GameId | undefined): TeamGame | null {
    const resolved = gameId ?? "hell_let_loose"
    return (TEAM_GAMES as readonly string[]).includes(resolved)
        ? (resolved as TeamGame)
        : null
}
