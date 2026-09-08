import { appCacheTags, cachedRead } from "@/lib/cache-tags"
import { fetchAction, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"

export type PerformanceSnapshot = {
    eventId: string
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
    cacheServerId = guildId
) {
    return cachedRead(
        ["guild-performance-history:v5", guildId],
        [appCacheTags.matches(cacheServerId)],
        async () => {
            const row = (await fetchQuery(guildRef, { guildId })) as {
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
    cacheServerId = guildId
) {
    return cachedRead(
        ["player-performance-history:v5", guildId, userId],
        [appCacheTags.matches(cacheServerId), appCacheTags.playerStats(userId)],
        async () => {
            const row = (await fetchQuery(playerRef, { guildId, userId })) as {
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
    cacheServerId = guildId
) {
    const uniqueIds = [...new Set(userIds)].sort()
    return cachedRead(
        ["player-performance-histories:v1", guildId, uniqueIds.join(",")],
        [
            appCacheTags.matches(cacheServerId),
            ...uniqueIds.map(appCacheTags.playerStats),
        ],
        async () => {
            return (await fetchQuery(playersRef, {
                guildId,
                userIds: uniqueIds,
            })) as Record<string, PerformanceSnapshot[]>
        },
        3600
    )
}
export async function refreshPerformanceHistory(guildId: string) {
    return fetchAction(refreshRef, { secret: getInternalAuthSecret(), guildId })
}
