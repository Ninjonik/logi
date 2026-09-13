import { v } from "convex/values"

import { assertInternalSecret } from "./discord_shared"
import { mutation, query } from "./_generated/server"

const requestResult = v.object({
    matchedVoiceCount: v.number(),
    rosteredCount: v.number(),
    reserveCount: v.number(),
    updatedCount: v.number(),
    updatedUserIds: v.array(v.string()),
})

export const requestMeetingAttendanceConfirmation = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        rosterId: v.id("rosters"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const [config, roster] = await Promise.all([
            ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .unique(),
            ctx.db.get(args.rosterId),
        ])
        if (!config?.meetingChannelId)
            throw new Error("Meeting channel is not configured.")
        if (!roster) throw new Error("Roster not found.")

        const event = await ctx.db.get(roster.eventId)
        if (!event || event.guildId !== args.guildId)
            throw new Error("Roster does not belong to this server.")

        const now = new Date()
        return await ctx.db.insert("meetingAttendanceRequests", {
            guildId: args.guildId,
            rosterId: args.rosterId,
            meetingChannelId: config.meetingChannelId,
            status: "pending",
            requestedAt: now.toISOString(),
            // A delayed request must never confirm attendance after the manager
            // has already been told that the bot was unavailable.
            expiresAt: new Date(now.getTime() + 15_000).toISOString(),
        })
    },
})

export const getMeetingAttendanceRequest = query({
    args: { secret: v.string(), requestId: v.id("meetingAttendanceRequests") },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        return await ctx.db.get(args.requestId)
    },
})

export const listPendingMeetingAttendanceRequests = query({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        return await ctx.db
            .query("meetingAttendanceRequests")
            .withIndex("status", (q) => q.eq("status", "pending"))
            .collect()
    },
})

export const claimMeetingAttendanceRequest = mutation({
    args: { secret: v.string(), requestId: v.id("meetingAttendanceRequests") },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const request = await ctx.db.get(args.requestId)
        if (!request || request.status !== "pending") return null

        const now = new Date()
        if (new Date(request.expiresAt) <= now) {
            await ctx.db.patch(request._id, {
                status: "failed",
                completedAt: now.toISOString(),
                error: "The bot did not respond in time.",
            })
            return null
        }

        await ctx.db.patch(request._id, {
            status: "processing",
            claimedAt: now.toISOString(),
        })
        return request
    },
})

export const completeMeetingAttendanceRequest = mutation({
    args: {
        secret: v.string(),
        requestId: v.id("meetingAttendanceRequests"),
        result: requestResult,
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const request = await ctx.db.get(args.requestId)
        if (!request || request.status !== "processing") return
        await ctx.db.patch(request._id, {
            status: "completed",
            completedAt: new Date().toISOString(),
            result: args.result,
        })
    },
})

export const failMeetingAttendanceRequest = mutation({
    args: {
        secret: v.string(),
        requestId: v.id("meetingAttendanceRequests"),
        error: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const request = await ctx.db.get(args.requestId)
        if (!request || request.status !== "processing") return
        await ctx.db.patch(request._id, {
            status: "failed",
            completedAt: new Date().toISOString(),
            error: args.error,
        })
    },
})
