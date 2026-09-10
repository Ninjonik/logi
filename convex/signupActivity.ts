import { canAccessServerContext } from "../src/infrastructure/convex/server-read-model"
import { getGuildDiscordId, getUserByDiscordId } from "./identity"
import { query } from "./_generated/server"
import { v } from "convex/values"

export const list = query({
    args: {
        serverId: v.id("guilds"),
        userId: v.string(),
        eventId: v.optional(v.id("events")),
    },
    handler: async (ctx, args) => {
        const [user, server] = await Promise.all([
            getUserByDiscordId(ctx, args.userId),
            ctx.db.get(args.serverId),
        ])
        if (!user || !server) return []

        const serverDiscordId = getGuildDiscordId(server)
        const discordAccess = await ctx.db
            .query("discordMemberAccess")
            .withIndex("guildId_userId", (q) =>
                q.eq("guildId", serverDiscordId).eq("userId", args.userId)
            )
            .unique()
        if (
            !canAccessServerContext({
                user,
                userId: args.userId,
                serverDiscordId,
                serverAdminIds: server.adminIds,
                dashboardAdminIds: server.dashboardAdminIds,
                adminAccessOverrides: server.adminAccessOverrides,
                discordAccess,
            })
        ) {
            return []
        }

        const eventId = args.eventId
        if (eventId) {
            const event = await ctx.db.get(eventId)
            if (!event || event.guildId !== serverDiscordId) return []
        }
        const activities = eventId
            ? await ctx.db
                  .query("signupActivities")
                  .withIndex("eventId_occurredAt", (q) =>
                      q.eq("eventId", eventId)
                  )
                  .order("desc")
                  .take(100)
            : await ctx.db
                  .query("signupActivities")
                  .withIndex("guildId_occurredAt", (q) =>
                      q.eq("guildId", serverDiscordId)
                  )
                  .order("desc")
                  .take(100)

        return activities.map((activity) => ({
            ...activity,
            id: String(activity._id),
            eventId: String(activity.eventId),
        }))
    },
})
