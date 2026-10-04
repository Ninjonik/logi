import { aggregateHistory } from "../game-data/history-report"
import type { HistoryRecord } from "../game-data/history"
import { z } from "zod"

export const statsGameSchema = z.enum(["hll", "wardogs"])
export const statsPeriodSchema = z.enum(["7d", "30d", "90d", "all"])
export type StatsGame = z.infer<typeof statsGameSchema>
export type StatsPeriod = z.infer<typeof statsPeriodSchema>

/** A self-declared public statistics lookup key, never proof of ownership. */
export function parseSteamId(input: string): string | null {
    let value = input.trim().replace(/^steam:/i, "")
    if (value.startsWith("https://")) {
        try {
            const url = new URL(value)
            if (
                url.hostname !== "steamcommunity.com" ||
                url.port ||
                url.username ||
                url.password ||
                url.search ||
                url.hash
            )
                return null
            value = /^\/profiles\/(\d{17})\/?$/.exec(url.pathname)?.[1] ?? ""
        } catch {
            return null
        }
    }
    if (!/^\d{17}$/.test(value)) return null
    const id = BigInt(value)
    return id > BigInt("76561197960265728") && id <= BigInt("76561202255233023")
        ? value
        : null
}

export function linkedSteamIds(values: readonly string[]): string[] {
    return [
        ...new Set(
            values.map(parseSteamId).filter((id): id is string => id !== null)
        ),
    ]
}

export function statsFrom(
    period: StatsPeriod,
    now: number
): string | undefined {
    return period === "all"
        ? undefined
        : new Date(now - Number(period.slice(0, -1)) * 86_400_000).toISOString()
}

export function wardogsPlayerStats(
    records: readonly HistoryRecord[],
    steamId: string
) {
    const report = aggregateHistory(records, 0)
    const player = report.players.find(
        (p) => p.platform === "steam" && p.platformId === steamId
    )
    if (!player) return null
    const latest = new Map<string, HistoryRecord>()
    for (const row of records) {
        const prior = latest.get(row.id)
        if (!prior || BigInt(row.revision) > BigInt(prior.revision))
            latest.set(row.id, row)
    }
    const factions = new Map<
        string,
        {
            name: string
            color: string | null
            matches: number
            wins: number
            kills: number | null
        }
    >()
    const recent = [...latest.values()]
        .flatMap((row) => {
            const fact = row.session.players.find(
                (p) => p.platform === "steam" && p.platformId === steamId
            )
            if (!fact) return []
            if (fact.faction) {
                const side = factions.get(fact.faction) ?? {
                    name: fact.faction,
                    color: null,
                    matches: 0,
                    wins: 0,
                    kills: null,
                }
                side.color =
                    row.session.warcon?.factions.find(
                        (f) => f.name === fact.faction
                    )?.colorHex ?? side.color
                side.matches++
                if (fact.result === "win") side.wins++
                if (typeof fact.metrics.kills === "number")
                    side.kills = (side.kills ?? 0) + fact.metrics.kills
                factions.set(side.name, side)
            }
            return [
                {
                    id: row.id,
                    endedAt: row.session.endedAt!,
                    map: row.session.map,
                    server: row.serverName,
                    ...fact,
                },
            ]
        })
        .sort(
            (a, b) =>
                b.endedAt.localeCompare(a.endedAt) || b.id.localeCompare(a.id)
        )
        .slice(0, 5)
    return {
        player,
        factions: [...factions.values()].sort((a, b) =>
            a.name.localeCompare(b.name)
        ),
        recent,
    }
}
export type WardogsPlayerStats = NonNullable<
    ReturnType<typeof wardogsPlayerStats>
>

export type HllProfile = {
    steamId: string
    name: string
    period: StatsPeriod
    sourceUrl: string
    kills: number | null
    deaths: number | null
    kd: number | null
    matches: number | null
    hours: number | null
    lowerBound: boolean
    teamKills: number | null
    elo: number | null
    /** Last 100 matches with >=20 minutes, NOT the period-wide win rate. */
    formWinRate: number | null
    recent: Array<{ label: string; url: string }>
    maps: string[]
    weapons: string[]
    warnings: string[]
}

export function hllProfileUrl(id: string, period: StatsPeriod, view = "") {
    if (parseSteamId(id) !== id || !["", "/matches", "/maps"].includes(view))
        throw new Error("Invalid HLL profile.")
    return `https://hllrecords.com/profiles/${id}${view}${period === "all" ? "" : `?period=${statsPeriodSchema.parse(period)}`}`
}
