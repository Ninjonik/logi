import { appCacheTags, cachedRead } from "@/lib/cache-tags"
import { fetchAction, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"
import type { GameScope } from "@/domain/games/game"
import { getInternalAuthSecret } from "@/lib/env"

export type PerformanceSnapshot = {
    eventId: string
    gameId?: Exclude<GameScope, "all">
    playedAt: string
    label: string
    combat: number
    offense: number
    support: number
    kills: number
    deaths: number
    points: number
    kd: number
}
const guildRef = makeFunctionReference<"query">("performanceHistory:getGuild")
const playerRef = makeFunctionReference<"query">("performanceHistory:getPlayer")
const playersRef = makeFunctionReference<"query">(
    "performanceHistory:getPlayers"
)
const refreshRef = makeFunctionReference<"action">(
    "performanceHistory:refreshInBackground"
)

export async function getGuildPerformanceHistory(
    guildId: string,
    cacheServerId = guildId,
    gameScope: GameScope = "all"
) {
    return cachedRead(
        ["guild-performance-history:v6", guildId, gameScope],
        [appCacheTags.matches(cacheServerId)],
        async () => {
            const row = (await fetchQuery(guildRef, {
                guildId,
                gameScope,
            })) as {
                matches: PerformanceSnapshot[]
            } | null
            return row?.matches ?? []
        },
        3600
    )
}
export async function getPlayerPerformanceHistory(
    guildId: string,
    userId: string,
    cacheServerId = guildId,
    gameScope: GameScope = "all"
) {
    return cachedRead(
        ["player-performance-history:v6", guildId, userId, gameScope],
        [appCacheTags.matches(cacheServerId), appCacheTags.playerStats(userId)],
        async () => {
            const row = (await fetchQuery(playerRef, {
                guildId,
                userId,
                gameScope,
            })) as {
                matches: PerformanceSnapshot[]
            } | null
            return row?.matches ?? []
        },
        3600
    )
}
export async function getPlayersPerformanceHistories(
    guildId: string,
    userIds: string[],
    cacheServerId = guildId,
    gameScope: GameScope = "all"
) {
    const uniqueIds = [...new Set(userIds)].sort()
    return cachedRead(
        [
            "player-performance-histories:v2",
            guildId,
            uniqueIds.join(","),
            gameScope,
        ],
        [
            appCacheTags.matches(cacheServerId),
            ...uniqueIds.map(appCacheTags.playerStats),
        ],
        async () => {
            return (await fetchQuery(playersRef, {
                guildId,
                userIds: uniqueIds,
                gameScope,
            })) as Record<string, PerformanceSnapshot[]>
        },
        3600
    )
}
export async function refreshPerformanceHistory(guildId: string) {
    return fetchAction(refreshRef, { secret: getInternalAuthSecret(), guildId })
}
