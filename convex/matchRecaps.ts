import { mutation, query, type QueryCtx } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"
import { v } from "convex/values"

import { calculateMatchRecapBaseline } from "../src/domain/match-results/match-recap-baseline"
import { canReceiveMatchRecap } from "../src/domain/match-results/match-recap-notifications"
import { getUserByIdentifier } from "./identity"

const INTERNAL_AUTH_SECRET =
    process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret"

function assertSecret(secret: string) {
    if (secret !== INTERNAL_AUTH_SECRET) throw new Error("Unauthorized.")
}

async function currentRecipient(ctx: QueryCtx, recap: Doc<"matchRecaps">) {
    if (
        recap.status !== "pending" ||
        !recap.userRecordId ||
        !recap.discordUserId ||
        !/^\d{17,20}$/.test(recap.discordUserId)
    )
        return null
    const user = await ctx.db.get(recap.userRecordId)
    if (
        !user ||
        user.discordId !== recap.discordUserId ||
        !canReceiveMatchRecap(user.matchRecapNotificationsEnabled)
    )
        return null
    const current = await getUserByIdentifier(ctx, recap.userId)
    return current?._id === user._id ? recap.discordUserId : null
}

async function pendingDelivery(
    ctx: QueryCtx,
    recap: Doc<"matchRecaps">,
    event: Doc<"events">
) {
    const discordUserId = await currentRecipient(ctx, recap)
    if (!discordUserId) return null
    const stats = await ctx.db
        .query("playerStats")
        .withIndex("userId", (q) => q.eq("userId", recap.userId))
        .collect()
    const current = stats
        .map((stat) => stat.matches[String(event._id)])
        .find(Boolean)
    if (!current) return null
    return {
        recapId: recap._id,
        userId: recap.userId,
        discordUserId,
        eventName: event.name,
        mapName: current.mapName,
        kills: current.kills,
        deaths: current.deaths,
        kd: current.killDeathRatio,
        previousTen: recap.previousTen,
    }
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
        const [event, roster, stats] = await Promise.all([
            ctx.db.get(args.eventId),
            ctx.db
                .query("rosters")
                .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                .unique(),
            ctx.db.query("playerStats").collect(),
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
        let queued = 0
        const baselineByUserId = new Map(
            args.baselines.map((item) => [item.userId, item])
        )
        for (const userId of linked) {
            const user = await getUserByIdentifier(ctx, userId)
            if (
                !user?.discordId ||
                !/^\d{17,20}$/.test(user.discordId) ||
                !canReceiveMatchRecap(user.matchRecapNotificationsEnabled)
            )
                continue
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
                userRecordId: user._id,
                discordUserId: user.discordId,
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
    args: {
        secret: v.string(),
        eventId: v.id("events"),
        deliveryVersion: v.optional(v.literal(2)),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        // Older bots interpret userId as a Discord subject; never give them this queue.
        if (args.deliveryVersion !== 2) return []
        const [event, recaps] = await Promise.all([
            ctx.db.get(args.eventId),
            ctx.db
                .query("matchRecaps")
                .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                .collect(),
        ])
        if (!event) return []
        const deliveries = await Promise.all(
            recaps.map((recap) => pendingDelivery(ctx, recap, event))
        )
        return deliveries.filter((delivery) => delivery !== null)
    },
})

export const prepareDelivery = query({
    args: {
        secret: v.string(),
        recapId: v.id("matchRecaps"),
        eventId: v.id("events"),
        discordUserId: v.string(),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const recap = await ctx.db.get(args.recapId)
        if (
            !recap ||
            recap.eventId !== args.eventId ||
            recap.discordUserId !== args.discordUserId
        )
            return null
        const event = await ctx.db.get(recap.eventId)
        return event ? pendingDelivery(ctx, recap, event) : null
    },
})

export const markSent = mutation({
    args: {
        secret: v.string(),
        recapId: v.id("matchRecaps"),
        discordUserId: v.string(),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const recap = await ctx.db.get(args.recapId)
        if (
            recap &&
            recap.status === "pending" &&
            recap.discordUserId === args.discordUserId
        )
            await ctx.db.patch(recap._id, {
                status: "sent",
                sentAt: new Date().toISOString(),
            })
    },
})

export const captureBaselines = query({
    args: {
        secret: v.string(),
        userIds: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        return await Promise.all(
            args.userIds.map(async (userId) => {
                // Match recap pages read directly from playerStats. Using the
                // same source prevents a delayed or missing derived-history
                // refresh from making the DM claim there is no prior history.
                const playerStats = await ctx.db
                    .query("playerStats")
                    .withIndex("userId", (q) => q.eq("userId", userId))
                    .collect()
                const baseline = calculateMatchRecapBaseline(
                    playerStats.flatMap((stat) => Object.values(stat.matches))
                )
                return {
                    userId,
                    ...baseline,
                }
            })
        )
    },
})
