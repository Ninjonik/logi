import {
    filterByGameScope,
    resolveGameScope,
    type GameId,
    type GameScope,
} from "../src/domain/games/game"
import { action, mutation, query } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { api } from "./_generated/api"
import { v } from "convex/values"

const gameIdValidator = v.union(
    v.literal("hell_let_loose"),
    v.literal("hell_let_loose_vietnam"),
    v.literal("wardogs")
)

const secret = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret"
type Snapshot = {
    eventId: string
    gameId?: GameId
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
const limitMatchesPerGame = <T extends { gameId?: GameId }>(matches: T[]) => {
    const counts = new Map<GameId, number>()
    return matches.filter((match) => {
        const gameId = resolveGameScope(match.gameId)
        const count = counts.get(gameId) ?? 0
        counts.set(gameId, count + 1)
        return count < 10
    })
}
const number = (value: unknown) =>
    Number.isFinite(Number(value)) ? Number(value) : 0
const whole = (value: number) => Math.round(value)
const clanPoints = (
    event: {
        eventResult?: {
            outcome: "victory" | "defeat" | "draw"
            score: { sideA: number; sideB: number }
        }
    },
    rows?: Array<{ team: { side: string } }>,
    raw?: { result: { axis: number; allied: number } }
) => {
    const score = event.eventResult?.score
    if (!score && raw && rows?.length) {
        const axisCount = rows.filter(
            (row) => row.team.side.toLowerCase() === "axis"
        ).length
        const alliedCount = rows.filter(
            (row) =>
                row.team.side.toLowerCase() === "allies" ||
                row.team.side.toLowerCase() === "allied"
        ).length
        return axisCount >= alliedCount ? raw.result.axis : raw.result.allied
    }
    if (!score) return 0
    if (event.eventResult?.outcome === "victory")
        return Math.max(score.sideA, score.sideB)
    if (event.eventResult?.outcome === "defeat")
        return Math.min(score.sideA, score.sideB)
    return score.sideA
}

export async function rebuildGuildPerformanceHistory(
    ctx: MutationCtx,
    guildId: string,
    includePlayers = true
) {
    const events = (
        await ctx.db
            .query("events")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect()
    )
        .filter((event) => event.kind !== "training" && event.matchStatsId)
        .sort(
            (a, b) =>
                new Date(b.eventResult?.endedAt ?? b.gameEnd).getTime() -
                new Date(a.eventResult?.endedAt ?? a.gameEnd).getTime()
        )
    const guildEvents = limitMatchesPerGame(events)
    const eventById = new Map(events.map((event) => [String(event._id), event]))
    const assignments = await ctx.db
        .query("userAssignments")
        .withIndex("serverId", (q) => q.eq("serverId", guildId))
        .collect()
    const clanUserIds = new Set(
        assignments.map((assignment) => assignment.userId)
    )
    const [stats, playerStatsByUser] = await Promise.all([
        Promise.all(
            guildEvents.map((event) =>
                ctx.db
                    .query("matchStats")
                    .withIndex("eventId", (q) => q.eq("eventId", event._id))
                    .unique()
            )
        ),
        Promise.all(
            [...clanUserIds].map((userId) =>
                ctx.db
                    .query("playerStats")
                    .withIndex("userId", (q) => q.eq("userId", userId))
                    .collect()
            )
        ),
    ])
    const playerDocs = playerStatsByUser.flat()
    const userByPlatformId = new Map(
        playerDocs
            .filter((doc) => doc.userId)
            .map((doc) => [doc.id, doc.userId!])
    )
    const guildMatches: Snapshot[] = []
    for (let index = 0; index < guildEvents.length; index++) {
        const event = guildEvents[index]!
        const eventGameId = resolveGameScope(event.gameId)
        const eventClanUserIds = new Set(
            filterByGameScope(assignments, eventGameId).map(
                (assignment) => assignment.userId
            )
        )
        const rows = (stats[index]?.raw.player_stats ?? []).filter((row) =>
            eventClanUserIds.has(userByPlatformId.get(row.player_id) ?? "")
        )
        if (!rows.length) continue
        const total = rows.reduce(
            (sum, row) => ({
                combat: sum.combat + number(row.combat),
                offense: sum.offense + number(row.offense),
                support: sum.support + number(row.support),
                kills: sum.kills + number(row.kills),
                deaths: sum.deaths + number(row.deaths),
            }),
            { combat: 0, offense: 0, support: 0, kills: 0, deaths: 0 }
        )
        guildMatches.push({
            eventId: String(event._id),
            gameId: event.gameId,
            playedAt: event.eventResult?.endedAt ?? event.gameEnd,
            label: event.name,
            combat: whole(total.combat / rows.length),
            offense: whole(total.offense / rows.length),
            support: whole(total.support / rows.length),
            kills: whole(total.kills / rows.length),
            deaths: whole(total.deaths / rows.length),
            points: clanPoints(event, rows, stats[index]?.raw),
            kd:
                whole(
                    (total.deaths ? total.kills / total.deaths : total.kills) *
                        100
                ) / 100,
        })
    }
    const now = new Date().toISOString()
    const guildExisting = await ctx.db
        .query("guildPerformanceHistory")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
    if (guildExisting)
        await ctx.db.patch(guildExisting._id, {
            matches: guildMatches,
            updatedAt: now,
        })
    else
        await ctx.db.insert("guildPerformanceHistory", {
            guildId,
            matches: guildMatches,
            updatedAt: now,
        })
    if (!includePlayers)
        return { guildMatches: guildMatches.length, players: 0 }
    const playerMatches = new Map<string, Map<string, Snapshot>>()
    for (const doc of playerDocs) {
        if (!doc.userId || !clanUserIds.has(doc.userId)) continue
        const matches =
            playerMatches.get(doc.userId) ?? new Map<string, Snapshot>()
        for (const [eventId, match] of Object.entries(doc.matches)) {
            const event = eventById.get(eventId)
            if (!event) continue
            const kills = number(match.kills),
                deaths = number(match.deaths)
            matches.set(eventId, {
                eventId,
                gameId: event.gameId,
                playedAt:
                    event.eventResult?.endedAt ??
                    event.gameEnd ??
                    match.endedAt ??
                    match.importedAt,
                label: event.name,
                combat: 0,
                offense: whole(number(match.offense)),
                support: whole(number(match.support)),
                kills: whole(kills),
                deaths: whole(deaths),
                points: clanPoints(event),
                kd: whole((deaths ? kills / deaths : kills) * 100) / 100,
            })
        }
        playerMatches.set(doc.userId, matches)
    }
    for (const [userId, matchesByEvent] of playerMatches) {
        const matches = [...matchesByEvent.values()].sort(
            (a, b) =>
                new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
        )
        const limitedMatches = limitMatchesPerGame(matches)
        const existing = await ctx.db
            .query("playerPerformanceHistory")
            .withIndex("guildId_userId", (q) =>
                q.eq("guildId", guildId).eq("userId", userId)
            )
            .unique()
        if (existing)
            await ctx.db.patch(existing._id, {
                matches: limitedMatches,
                updatedAt: now,
            })
        else
            await ctx.db.insert("playerPerformanceHistory", {
                guildId,
                userId,
                matches: limitedMatches,
                updatedAt: now,
            })
    }
    return { guildMatches: guildMatches.length, players: playerMatches.size }
}

export const refreshForGuild = mutation({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        if (args.secret !== secret) throw new Error("Unauthorized.")
        return rebuildGuildPerformanceHistory(ctx, args.guildId)
    },
})
export const listClanUserIds = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        if (args.secret !== secret) throw new Error("Unauthorized.")
        return [
            ...new Set(
                (
                    await ctx.db
                        .query("userAssignments")
                        .withIndex("serverId", (q) =>
                            q.eq("serverId", args.guildId)
                        )
                        .collect()
                ).map((assignment) => assignment.userId)
            ),
        ]
    },
})
export const refreshGuildOnly = mutation({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        if (args.secret !== secret) throw new Error("Unauthorized.")
        return rebuildGuildPerformanceHistory(ctx, args.guildId, false)
    },
})
export const refreshPlayerForGuild = mutation({
    args: { secret: v.string(), guildId: v.string(), userId: v.string() },
    handler: async (ctx, args) => {
        if (args.secret !== secret) throw new Error("Unauthorized.")
        const [events, docs] = await Promise.all([
            ctx.db
                .query("events")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .collect(),
            ctx.db
                .query("playerStats")
                .withIndex("userId", (q) => q.eq("userId", args.userId))
                .collect(),
        ])
        const eventById = new Map(
            events
                .filter(
                    (event) => event.kind !== "training" && event.matchStatsId
                )
                .map((event) => [String(event._id), event])
        )
        const matches = new Map<string, Snapshot>()
        for (const doc of docs)
            for (const [eventId, match] of Object.entries(doc.matches)) {
                const event = eventById.get(eventId)
                if (!event) continue
                const kills = number(match.kills),
                    deaths = number(match.deaths)
                matches.set(eventId, {
                    eventId,
                    gameId: event.gameId,
                    playedAt: event.eventResult?.endedAt ?? event.gameEnd,
                    label: event.name,
                    combat: 0,
                    offense: whole(number(match.offense)),
                    support: whole(number(match.support)),
                    kills: whole(kills),
                    deaths: whole(deaths),
                    points: clanPoints(event),
                    kd: whole((deaths ? kills / deaths : kills) * 100) / 100,
                })
            }
        const history = [...matches.values()].sort(
            (a, b) =>
                new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
        )
        const limitedHistory = limitMatchesPerGame(history)
        const existing = await ctx.db
            .query("playerPerformanceHistory")
            .withIndex("guildId_userId", (q) =>
                q.eq("guildId", args.guildId).eq("userId", args.userId)
            )
            .unique()
        const updatedAt = new Date().toISOString()
        if (existing)
            await ctx.db.patch(existing._id, {
                matches: limitedHistory,
                updatedAt,
            })
        else
            await ctx.db.insert("playerPerformanceHistory", {
                guildId: args.guildId,
                userId: args.userId,
                matches: limitedHistory,
                updatedAt,
            })
        return { matches: limitedHistory.length }
    },
})
export const refreshInBackground = action({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (
        ctx,
        args
    ): Promise<{ guildMatches: number; players: number }> => {
        if (args.secret !== secret) throw new Error("Unauthorized.")
        const guild: { guildMatches: number; players: number } =
            await ctx.runMutation(api.performanceHistory.refreshGuildOnly, args)
        const userIds: string[] = await ctx.runQuery(
            api.performanceHistory.listClanUserIds,
            args
        )
        for (const userId of userIds)
            await ctx.runMutation(
                api.performanceHistory.refreshPlayerForGuild,
                { ...args, userId }
            )
        return { ...guild, players: userIds.length }
    },
})
function normalizeHistory<
    T extends {
        matches: Array<
            Omit<Snapshot, "offense" | "points" | "kd"> &
                Partial<Pick<Snapshot, "offense" | "points" | "kd">>
        >
    },
>(history: T | null) {
    return (
        history && {
            ...history,
            matches: history.matches.map((match) => ({
                ...match,
                offense: match.offense ?? 0,
                points: match.points ?? 0,
                kd:
                    match.kd ??
                    (match.deaths ? match.kills / match.deaths : match.kills),
            })),
        }
    )
}
export const getGuild = query({
    args: {
        guildId: v.string(),
        gameScope: v.optional(v.union(v.literal("all"), gameIdValidator)),
    },
    handler: async (ctx, args) => {
        const history = normalizeHistory(
            await ctx.db
                .query("guildPerformanceHistory")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .unique()
        )
        return (
            history && {
                ...history,
                matches: filterByGameScope(history.matches, args.gameScope),
            }
        )
    },
})
export const getPlayer = query({
    args: {
        guildId: v.string(),
        userId: v.string(),
        gameScope: v.optional(v.union(v.literal("all"), gameIdValidator)),
    },
    handler: async (ctx, args) => {
        const history = normalizeHistory(
            await ctx.db
                .query("playerPerformanceHistory")
                .withIndex("guildId_userId", (q) =>
                    q.eq("guildId", args.guildId).eq("userId", args.userId)
                )
                .unique()
        )
        return (
            history && {
                ...history,
                matches: filterByGameScope(history.matches, args.gameScope),
            }
        )
    },
})
export const getPlayers = query({
    args: {
        guildId: v.string(),
        userIds: v.array(v.string()),
        gameScope: v.optional(v.union(v.literal("all"), gameIdValidator)),
    },
    handler: async (ctx, args) => {
        const rows = await Promise.all(
            [...new Set(args.userIds)].map((userId) =>
                ctx.db
                    .query("playerPerformanceHistory")
                    .withIndex("guildId_userId", (q) =>
                        q.eq("guildId", args.guildId).eq("userId", userId)
                    )
                    .unique()
            )
        )
        return Object.fromEntries(
            rows
                .filter((row): row is NonNullable<typeof row> => Boolean(row))
                .map((row) => [
                    row.userId,
                    filterByGameScope(
                        normalizeHistory(row)!.matches,
                        args.gameScope
                    ),
                ])
        )
    },
})
