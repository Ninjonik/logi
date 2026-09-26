import { query } from "./_generated/server"
import { v } from "convex/values"

import { getGuildDiscordId } from "./identity"

/**
 * Public data for an unguessable, clan-specific iCalendar subscription URL.
 * The token is checked here rather than exposing the regular server context.
 */
export const getCalendarFeed = query({
    args: {
        guildId: v.id("guilds"),
        token: v.string(),
    },
    handler: async (ctx, args) => {
        const guild = await ctx.db.get(args.guildId)
        if (!guild) return null

        const guildId = getGuildDiscordId(guild)
        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .unique()
        if (
            !config?.calendarFeedToken ||
            config.calendarFeedToken !== args.token
        ) {
            return null
        }

        const [events, calendarItems] = await Promise.all([
            ctx.db
                .query("events")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect(),
            ctx.db
                .query("calendarItems")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect(),
        ])

        return {
            clanName: guild.name,
            events: events.map((event) => ({
                ...event,
                id: String(event._id),
            })),
            calendarItems: calendarItems.map((item) => ({
                ...item,
                id: String(item._id),
            })),
        }
    },
})
