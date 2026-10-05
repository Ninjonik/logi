import { v } from "convex/values"

import { mutation, query, type MutationCtx } from "./_generated/server"
import { assertInternalSecret } from "./discord_shared"
import type { Doc, Id } from "./_generated/dataModel"

/** A claim the bot never finished may be taken again after this time. */
const CLAIM_TIMEOUT_MS = 5 * 60 * 1000

const slot = v.object({
    userId: v.string(),
    squad: v.string(),
    role: v.optional(v.string()),
})

/**
 * Queues the change digest and change DMs of a re-published roster (boards
 * L1-120..126, L2-35..40, D5). The Next route checks the session, the clan
 * admin right and the origin, keeps only clan members in `before` and
 * passes the admin's Discord ID; this function checks the internal secret
 * and that the published roster belongs to the match and the clan. The bot
 * sends the messages.
 */
export const request = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        eventId: v.string(),
        rosterId: v.string(),
        requestedBy: v.string(),
        before: v.array(slot),
        notifyPlayers: v.boolean(),
        postDigest: v.boolean(),
        mentionPlayers: v.boolean(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const eventId = ctx.db.normalizeId("events", args.eventId)
        const rosterId = ctx.db.normalizeId("rosters", args.rosterId)
        const [event, roster] = await Promise.all([
            eventId ? ctx.db.get(eventId) : null,
            rosterId ? ctx.db.get(rosterId) : null,
        ])
        if (
            !event ||
            !roster ||
            event.guildId !== args.guildId ||
            roster.eventId !== event._id ||
            (roster.guildId !== undefined && roster.guildId !== args.guildId)
        )
            return { status: "not_found" as const }
        if (!roster.published) return { status: "not_published" as const }
        if (!args.notifyPlayers && !args.postDigest && !args.mentionPlayers)
            return { status: "nothing" as const }
        const id = await ctx.db.insert("rosterChangeRequests", {
            guildId: event.guildId,
            eventId: event._id,
            rosterId: roster._id,
            requestedBy: args.requestedBy,
            requestedAt: new Date().toISOString(),
            before: args.before.slice(0, 500).map((item) => ({
                userId: item.userId.slice(0, 32),
                squad: item.squad.slice(0, 100),
                ...(item.role ? { role: item.role.slice(0, 100) } : {}),
            })),
            notifyPlayers: args.notifyPlayers,
            postDigest: args.postDigest,
            mentionPlayers: args.mentionPlayers,
            status: "pending",
        })
        return { status: "queued" as const, requestId: String(id) }
    },
})

/**
 * Where a request stands, for the publish dialog: how many change DMs
 * Discord accepted and refused (board L2-64). Scoped to the clan.
 */
export const status = query({
    args: { secret: v.string(), guildId: v.string(), requestId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const id = ctx.db.normalizeId("rosterChangeRequests", args.requestId)
        const row = id ? await ctx.db.get(id) : null
        if (!row || row.guildId !== args.guildId) return null
        return {
            status: row.status,
            dmSent: row.dmSentUserIds?.length ?? 0,
            dmFailedUserIds: row.dmFailedUserIds ?? [],
            digestPosted: Boolean(row.digestPosted),
        }
    },
})

/** Pending requests, watched by the bot. */
export const listPending = query({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const pending = await ctx.db
            .query("rosterChangeRequests")
            .withIndex("status", (q) => q.eq("status", "pending"))
            .take(50)
        return pending.map((row) => ({
            id: String(row._id),
            eventId: String(row.eventId),
            guildId: row.guildId,
        }))
    },
})

/**
 * The bot takes a request before sending. It gets the version the request
 * replaced, the digest's baseline (the version before the match's first
 * digest, so the digest lists every change since) and the clan's members,
 * the only people a change DM may go to.
 */
export const claim = mutation({
    args: { secret: v.string(), requestId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const id = ctx.db.normalizeId("rosterChangeRequests", args.requestId)
        const row = id ? await ctx.db.get(id) : null
        const now = new Date()
        if (
            !row ||
            (row.status !== "pending" &&
                !(
                    row.status === "processing" &&
                    now.getTime() - new Date(row.claimedAt ?? 0).getTime() >
                        CLAIM_TIMEOUT_MS
                ))
        )
            return null
        const [event, roster] = await Promise.all([
            ctx.db.get(row.eventId),
            ctx.db.get(row.rosterId),
        ])
        if (!event || !roster || event.guildId !== row.guildId) {
            await ctx.db.patch(row._id, {
                status: "failed",
                completedAt: now.toISOString(),
                error: "match_not_found",
            })
            return null
        }
        const earlier = await ctx.db
            .query("rosterChangeRequests")
            .withIndex("eventId_requestedAt", (q) =>
                q.eq("eventId", row.eventId)
            )
            .order("asc")
            .take(200)
        const baseline =
            earlier.find(
                (item) =>
                    item._id !== row._id &&
                    item.digestPosted === true &&
                    item.requestedAt <= row.requestedAt
            ) ?? row
        const members = await ctx.db
            .query("userAssignments")
            .withIndex("serverId", (q) => q.eq("serverId", event.guildId))
            .collect()
        await ctx.db.patch(row._id, {
            status: "processing",
            claimedAt: now.toISOString(),
        })
        return {
            id: String(row._id),
            eventId: String(row.eventId),
            guildId: row.guildId,
            requestedAt: row.requestedAt,
            before: row.before,
            digestBaseline: baseline.before,
            notifyPlayers: row.notifyPlayers,
            postDigest: row.postDigest,
            mentionPlayers: row.mentionPlayers,
            memberIds: [
                ...new Set(members.map((assignment) => assignment.userId)),
            ],
        }
    },
})

async function finish(
    ctx: MutationCtx,
    requestId: string,
    patch: Partial<Doc<"rosterChangeRequests">>
) {
    const id = ctx.db.normalizeId("rosterChangeRequests", requestId)
    const row = id ? await ctx.db.get(id) : null
    if (!row || row.status !== "processing") return
    await ctx.db.patch(row._id as Id<"rosterChangeRequests">, {
        ...patch,
        completedAt: new Date().toISOString(),
    })
}

export const complete = mutation({
    args: {
        secret: v.string(),
        requestId: v.string(),
        dmSentUserIds: v.array(v.string()),
        dmFailedUserIds: v.array(v.string()),
        digestPosted: v.boolean(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        await finish(ctx, args.requestId, {
            status: "sent",
            dmSentUserIds: args.dmSentUserIds.slice(0, 500),
            dmFailedUserIds: args.dmFailedUserIds.slice(0, 500),
            digestPosted: args.digestPosted,
        })
    },
})

export const fail = mutation({
    args: { secret: v.string(), requestId: v.string(), error: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        await finish(ctx, args.requestId, {
            status: "failed",
            error: args.error.slice(0, 100),
        })
    },
})
