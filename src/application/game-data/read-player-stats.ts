import {
    parseSteamId,
    wardogsPlayerStats,
    type HllProfile,
    type StatsGame,
    type StatsPeriod,
} from "../../domain/player-stats/player-stats"
import type { HistoryRecord } from "../../domain/game-data/history"

export type HllStatsRead = {
    status: "ok" | "stale" | "empty" | "unavailable"
    profile: HllProfile | null
    fetchedAt: string | null
    reason: string | null
}
export type StatsRequest = {
    guildId: string
    requesterId: string
    targetId: string
    game: StatsGame
    period: StatsPeriod
    playerId?: string
    sourceId?: string
}
export type PlayerStatsPorts = {
    authorize: (request: StatsRequest) => Promise<boolean>
    account: (
        request: StatsRequest
    ) => Promise<{ steamIds: string[]; name: string | null }>
    hll: (id: string, period: StatsPeriod) => Promise<HllStatsRead>
    history: (
        request: StatsRequest,
        steamId?: string
    ) => Promise<{ records: HistoryRecord[]; lastCollectedAt: string | null }>
}
export async function readPlayerStats(
    request: StatsRequest,
    ports: PlayerStatsPorts
) {
    if (!(await ports.authorize(request))) throw new Error("forbidden")
    if (request.game === "hll" && (request.playerId || request.sourceId))
        throw new Error("linked_only")
    const account = request.playerId ? null : await ports.account(request)
    if (account && !account.steamIds.length)
        return { kind: "missing_link" as const, account }
    if (account && account.steamIds.length !== 1)
        return { kind: "ambiguous_link" as const, account }
    const steamId = parseSteamId(request.playerId ?? account!.steamIds[0])
    if (!steamId) throw new Error("invalid_steam")
    const result =
        request.game === "hll"
            ? {
                  kind: "hll" as const,
                  steamId,
                  name: account?.name ?? null,
                  read: await ports.hll(steamId, request.period),
              }
            : await (async () => {
                  const history = await ports.history(request, steamId)
                  return {
                      kind: "wardogs" as const,
                      steamId,
                      name: account?.name ?? null,
                      stats: wardogsPlayerStats(history.records, steamId),
                      fetchedAt: history.lastCollectedAt,
                  }
              })()
    if (!(await ports.authorize(request))) throw new Error("forbidden")
    if (account) {
        const latest = await ports.account(request)
        if (latest.steamIds.length !== 1 || latest.steamIds[0] !== steamId)
            throw new Error("link_changed")
    }
    return result
}
export type PlayerStatsResult = Awaited<ReturnType<typeof readPlayerStats>>
