import { v } from "convex/values"

import { messageSettingsPatch } from "../src/domain/discord-messages/notification-settings"
import { getGuildById, getGuildDiscordId } from "./identity"
import { assertInternalSecret } from "./discord_shared"
import { mutation } from "./_generated/server"

/**
 * The settings of the "Zprávy a panely" page (board N1) besides the look
 * and the errors channel: the roster message default, the publish dialog's
 * defaults, the attendance post in the match thread and the per-message
 * switches. Internal secret only: the Next route checks the clan admin
 * first. Only the supplied settings change.
 */
export const save = mutation({
    args: {
        secret: v.string(),
        guildId: v.id("guilds"),
        settings: v.object({
            rosterMessageVariant: v.optional(
                v.union(v.literal("photo_text"), v.literal("photo"))
            ),
            rosterChangesPost: v.optional(v.boolean()),
            rosterChangesDm: v.optional(v.boolean()),
            attendanceNoticesInThread: v.optional(v.boolean()),
            debriefPost: v.optional(v.boolean()),
            scheduledEvent: v.optional(v.boolean()),
            matchRecapDm: v.optional(v.boolean()),
            trainingResultDm: v.optional(v.boolean()),
            applicationCloseDm: v.optional(v.boolean()),
            ticketCloseDm: v.optional(v.boolean()),
        }),
    },
    handler: async (ctx, { secret, guildId, settings }) => {
        assertInternalSecret(secret)
        const guild = await getGuildById(ctx, guildId)
        if (!guild) throw new Error("Server not found.")
        const guildDiscordId = getGuildDiscordId(guild)
        const fields = messageSettingsPatch(settings)
        const now = new Date().toISOString()
        const existing = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
            .unique()
        if (existing) {
            await ctx.db.patch(existing._id, { ...fields, updatedAt: now })
            return String(existing._id)
        }
        return String(
            await ctx.db.insert("discordConfigs", {
                ...fields,
                guildId: guildDiscordId,
                timezone: "UTC",
                defaultLanguage: "en",
                calendarCategories: [],
                createdAt: now,
                updatedAt: now,
            })
        )
    },
})
