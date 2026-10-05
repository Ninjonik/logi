import { listPublicCompetitions } from "@/lib/read-models/competitions"
import type { GameId } from "@/domain/games/game"
import { logNextError } from "@/lib/system-logs"

/**
 * Competitions a "Tabulka soutěže" panel can show (L3-19..24): the published
 * Logi competitions of the clan's games. An unavailable read gives none, so
 * the panel pages still open.
 */
export async function panelCompetitions(
    enabledGames: readonly GameId[]
): Promise<Array<{ id: string; name: string; gameId: string }>> {
    try {
        return (await listPublicCompetitions())
            .filter((competition) => enabledGames.includes(competition.gameId))
            .map((competition) => ({
                id: competition.id,
                name: competition.season
                    ? `${competition.name} · ${competition.season}`
                    : competition.name,
                gameId: competition.gameId,
            }))
    } catch (error) {
        logNextError("discord-panels", "Failed to list competitions", {
            error,
        })
        return []
    }
}
