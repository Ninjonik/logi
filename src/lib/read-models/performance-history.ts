import type { DashboardActor } from "../../../convex/dashboardActor"
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
    cashDelta?: number | null
    kd: number
}
const guildRef = makeFunctionReference<"query">("performanceHistory:getGuild")
const playerRef = makeFunctionReference<"query">("performanceHistory:getPlayer")
const playersRef = makeFunctionReference<"query">(
    "performanceHistory:getPlayers"
)
const refreshRef = makeFunctionReference<"action">(
    "performanceHistory:refreshForDashboard"
)

/** Histories are already materialized and bounded. Read them without the
 * dashboard cache so a background import refresh is visible on the next read. */
export async function getGuildPerformanceHistory(
    guildId: string,
    gameScope: GameScope = "all"
) {
    const row = (await fetchQuery(guildRef, {
        secret: getInternalAuthSecret(),
        guildId,
        gameScope,
    })) as { matches: PerformanceSnapshot[] } | null
    return row?.matches ?? []
}
export async function getPlayerPerformanceHistory(
    guildId: string,
    userId: string,
    gameScope: GameScope = "all"
) {
    const row = (await fetchQuery(playerRef, {
        secret: getInternalAuthSecret(),
        guildId,
        userId,
        gameScope,
    })) as { matches: PerformanceSnapshot[] } | null
    return row?.matches ?? []
}
export async function getPlayersPerformanceHistories(
    guildId: string,
    userIds: string[],
    gameScope: GameScope = "all"
) {
    return (await fetchQuery(playersRef, {
        secret: getInternalAuthSecret(),
        guildId,
        userIds: [...new Set(userIds)].sort(),
        gameScope,
    })) as Record<string, PerformanceSnapshot[]>
}
/**
 * "Refresh performance history": the workspace and every member's history
 * for one game. Convex checks the actor's clan-admin right from the
 * dashboard session again before it reads anything.
 */
export async function refreshPerformanceHistory(
    guildId: string,
    gameId: Exclude<GameScope, "all">,
    actor: DashboardActor
) {
    return fetchAction(refreshRef, {
        secret: getInternalAuthSecret(),
        guildId,
        gameId,
        actor,
    })
}
