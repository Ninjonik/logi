import type { GameId } from "@/domain/games/game"

/**
 * `POST /api/servers/{serverId}/enabled-games`: the games the clan plays. The
 * games page and the setup guide both save through it.
 */
export async function saveEnabledGames(
    serverId: string,
    enabledGames: readonly GameId[]
): Promise<{ ok: boolean }> {
    const response = await fetch(`/api/servers/${serverId}/enabled-games`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabledGames }),
    }).catch(() => null)
    return { ok: Boolean(response?.ok) }
}
