import { v } from "convex/values"

import { matchTitle } from "../src/domain/discord-messages/match-text"
import { assertInternalSecret } from "./discord_shared"
import { getGuildByDiscordId } from "./identity"
import { query } from "./_generated/server"

/**
 * What an errors-channel entry needs besides the Discord answer (board L5
 * 1.1): where the clan's errors channel is, its language, zone and colour,
 * its dashboard ID for the links to Logi, the channels the bot posts to
 * (to work out which permission is missing) and, for a match, its title,
 * category and start. Internal secret only (the bot); the event must belong
 * to the same clan.
 */
export const context = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        eventId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .unique()
        if (!config?.errorsChannelId) return null
        const guild = await getGuildByDiscordId(ctx, args.guildId)
        const eventId = args.eventId
            ? ctx.db.normalizeId("events", args.eventId)
            : null
        const found = eventId ? await ctx.db.get(eventId) : null
        const event = found && found.guildId === args.guildId ? found : null
        const matchType = event?.matchType?.trim()
        const category =
            event && (event.kind ?? "match") === "match" && matchType
                ? (guild?.eventCategories?.find(
                      (item) =>
                          item.id.trim().toLowerCase() ===
                          matchType.toLowerCase()
                  )?.label ?? matchType)
                : null
        return {
            errorsChannelId: config.errorsChannelId,
            language: config.defaultLanguage ?? "en",
            timeZone: config.timezone || "UTC",
            messageStyle: config.messageStyle ?? null,
            // The clan's dashboard ID, for the links to Logi.
            serverId: guild ? String(guild._id) : null,
            channels: {
                announcements: config.announcementsChannelId ?? null,
                eventInfo: config.eventInfoChannelId ?? null,
                calendar: config.calendarChannelId ?? null,
                forumCategory: config.forumCategoryId ?? null,
                meeting: config.meetingChannelId ?? null,
                ticketPanel: config.ticketSettings?.submitChannelId ?? null,
                ticketThreads:
                    config.ticketSettings?.ticketParentChannelId ?? null,
                applicationPanel:
                    config.membershipSettings?.submitChannelId ?? null,
                applicationThreads:
                    config.membershipSettings?.applicationParentChannelId ??
                    null,
            },
            event: event
                ? {
                      id: String(event._id),
                      kind: event.kind ?? "match",
                      title: matchTitle(event),
                      category,
                      gameStart: event.gameStart,
                      announcementChannelId:
                          event.announcementChannelId ?? null,
                      meetingChannelId: event.meetingChannelId ?? null,
                  }
                : null,
        }
    },
})
