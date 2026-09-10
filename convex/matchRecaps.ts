import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

const INTERNAL_AUTH_SECRET =
    process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret"

function assertSecret(secret: string) {
    if (secret !== INTERNAL_AUTH_SECRET) throw new Error("Unauthorized.")
}

/** Queues one recap only for a person who both played in a squad slot and has
 * a linked player-stat row for this event. */
export const queueForPublishedResult = mutation({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
        baselines: v.array(
            v.object({
                userId: v.string(),
                matches: v.number(),
                kills: v.number(),
                deaths: v.number(),
                kd: v.number(),
            })
        ),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const [event, roster, stats, users] = await Promise.all([
            ctx.db.get(args.eventId),
            ctx.db
                .query("rosters")
                .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                .unique(),
            ctx.db.query("playerStats").collect(),
            ctx.db.query("users").collect(),
        ])
        if (!event?.eventResult || !roster) return { queued: 0 }
        const rostered = new Set(
            roster.squads.flatMap((s) =>
                s.players.flatMap((p) => (p.id ? [p.id] : []))
            )
        )
        const linked = new Set(
            stats.flatMap((stat) =>
                stat.userId &&
                rostered.has(stat.userId) &&
                Object.prototype.hasOwnProperty.call(
                    stat.matches,
                    String(args.eventId)
                )
                    ? [stat.userId]
                    : []
            )
        )
        const optedOut = new Set(
            users
                .filter((user) => user.matchRecapNotificationsEnabled === false)
                .map((user) => user.id ?? user.discordId)
                .filter((id): id is string => Boolean(id))
        )
        let queued = 0
        const baselineByUserId = new Map(
            args.baselines.map((item) => [item.userId, item])
        )
        for (const userId of linked) {
            if (optedOut.has(userId)) continue
            const existing = await ctx.db
                .query("matchRecaps")
                .withIndex("eventId_userId", (q) =>
                    q.eq("eventId", args.eventId).eq("userId", userId)
                )
                .unique()
            if (existing) continue
            const baseline = baselineByUserId.get(userId)
            await ctx.db.insert("matchRecaps", {
                eventId: args.eventId,
                userId,
                status: "pending",
                previousTen: baseline && {
                    matches: baseline.matches,
                    kills: baseline.kills,
                    deaths: baseline.deaths,
                    kd: baseline.kd,
                },
                createdAt: new Date().toISOString(),
            })
            queued++
        }
        return { queued }
    },
})

export const listPendingForEvent = query({
    args: { secret: v.string(), eventId: v.id("events") },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const [event, recaps, stats] = await Promise.all([
            ctx.db.get(args.eventId),
            ctx.db
                .query("matchRecaps")
                .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                .collect(),
            ctx.db.query("playerStats").collect(),
        ])
        if (!event) return []
        return recaps
            .filter((r) => r.status === "pending")
            .flatMap((recap) => {
                const current = stats
                    .flatMap((s) =>
                        s.userId === recap.userId
                            ? [s.matches[String(args.eventId)]]
                            : []
                    )
                    .find(Boolean)
                return current
                    ? [
                          {
                              userId: recap.userId,
                              eventName: event.name,
                              mapName: current.mapName,
                              kills: current.kills,
                              deaths: current.deaths,
                              kd: current.killDeathRatio,
                              previousTen: recap.previousTen,
                          },
                      ]
                    : []
            })
    },
})

export const markSent = mutation({
    args: { secret: v.string(), eventId: v.id("events"), userId: v.string() },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const recap = await ctx.db
            .query("matchRecaps")
            .withIndex("eventId_userId", (q) =>
                q.eq("eventId", args.eventId).eq("userId", args.userId)
            )
            .unique()
        if (recap && recap.status === "pending")
            await ctx.db.patch(recap._id, {
                status: "sent",
                sentAt: new Date().toISOString(),
            })
    },
})

export const captureBaselines = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        userIds: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        return await Promise.all(
            args.userIds.map(async (userId) => {
                const history = await ctx.db
                    .query("playerPerformanceHistory")
                    .withIndex("guildId_userId", (q) =>
                        q.eq("guildId", args.guildId).eq("userId", userId)
                    )
                    .unique()
                const matches = history?.matches.slice(0, 10) ?? []
                const count = matches.length || 1
                return {
                    userId,
                    matches: matches.length,
                    kills:
                        matches.reduce((sum, match) => sum + match.kills, 0) /
                        count,
                    deaths:
                        matches.reduce((sum, match) => sum + match.deaths, 0) /
                        count,
                    kd:
                        matches.reduce(
                            (sum, match) => sum + (match.kd ?? 0),
                            0
                        ) / count,
                }
            })
        )
    },
})
