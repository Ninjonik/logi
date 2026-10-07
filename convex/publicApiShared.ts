import { omitResultStorage } from "../src/domain/api/result-summaries"
import { resolveGameScope } from "../src/domain/games/game"
import { internalAuthSecret } from "./discord_shared"
import type { Doc } from "./_generated/dataModel"

/** Helpers shared by the `/api/v1` reads (`publicApiReads.ts`) and writes (`publicApi.ts`). */
export function assertInternalSecret(secret: string) {
    if (secret !== internalAuthSecret()) throw new Error("Unauthorized.")
}

/** The Discord configuration as the API shows it: no player-stat tokens. */
export function safeDiscordConfigOf(
    discordConfig: Doc<"discordConfigs"> | null
) {
    if (!discordConfig) return null
    const {
        playerStatsServers: _playerStatsServers,
        gameOverrides,
        ...config
    } = discordConfig
    return {
        ...config,
        id: String(discordConfig._id),
        ...(gameOverrides
            ? {
                  gameOverrides: Object.fromEntries(
                      Object.entries(gameOverrides).map(
                          ([gameId, override]) => {
                              const {
                                  playerStatsServers: _tokens,
                                  ...safeOverride
                              } = override
                              return [gameId, safeOverride]
                          }
                      )
                  ),
              }
            : {}),
    }
}

export function apiDocument<T extends { _id: unknown; gameId?: unknown }>(
    document: T
) {
    return {
        ...omitResultStorage(document),
        id: String(document._id),
        ...(Object.prototype.hasOwnProperty.call(document, "gameId")
            ? { gameId: resolveGameScope(document.gameId as never) }
            : {}),
    }
}
