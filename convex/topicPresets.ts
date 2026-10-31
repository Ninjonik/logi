import { topicPresetRepository } from "../src/infrastructure/convex/preset-repositories"
import { eventsBlockingTopicPresetDeletion } from "../src/domain/events/preset-deletion"
import { saveTopicPreset } from "../src/application/presets/save-preset"
import { topicPresetSchema } from "../src/lib/validation/topic-preset"
import { getGuildById, getGuildDiscordId } from "./identity"
import { systemClock } from "../src/domain/shared/clock"
import { internalAuthSecret } from "./discord_shared"
import { mutation } from "./_generated/server"
import { v } from "convex/values"

function assertInternalSecret(secret: string) {
    if (secret !== internalAuthSecret()) {
        throw new Error("Unauthorized.")
    }
}

const topic = v.object({
    id: v.optional(v.string()),
    title: v.string(),
    body: v.optional(v.string()),
    attachments: v.array(v.string()),
    messages: v.optional(
        v.array(
            v.object({
                id: v.string(),
                body: v.optional(v.string()),
                attachments: v.array(v.string()),
            })
        )
    ),
})

export const upsert = mutation({
    args: {
        secret: v.string(),
        serverId: v.id("guilds"),
        presetId: v.optional(v.id("topicPresets")),
        name: v.string(),
        side: v.optional(v.string()),
        map: v.optional(v.string()),
        cap: v.optional(v.string()),
        notes: v.optional(v.string()),
        topics: v.array(topic),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const guild = await getGuildById(ctx, args.serverId)
        if (!guild) {
            throw new Error("Server not found.")
        }
        const fields = topicPresetSchema.parse(args)
        const saved = await saveTopicPreset(
            topicPresetRepository(ctx),
            systemClock,
            {
                ...fields,
                guildId: getGuildDiscordId(guild),
                presetId: args.presetId,
            }
        )
        return saved.id
    },
})

/**
 * Deletes a topic preset of this clan unless an event that is not concluded
 * still uses it; those events copy its topics into their forum and can resync.
 */
export const remove = mutation({
    args: {
        secret: v.string(),
        serverId: v.id("guilds"),
        presetId: v.id("topicPresets"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const guild = await getGuildById(ctx, args.serverId)
        if (!guild) {
            throw new Error("Server not found.")
        }
        const guildDiscordId = getGuildDiscordId(guild)
        const existing = await ctx.db.get(args.presetId)
        if (!existing || existing.guildId !== guildDiscordId) {
            return { ok: false as const, error: "not_found" as const }
        }

        const events = await ctx.db
            .query("events")
            .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
            .collect()
        const blocking = eventsBlockingTopicPresetDeletion(
            events.map((event) => ({
                ...event,
                topicPresetId: event.topicPresetId
                    ? String(event.topicPresetId)
                    : undefined,
            })),
            String(args.presetId)
        )
        if (blocking.length) {
            return {
                ok: false as const,
                error: "in_use" as const,
                eventCount: blocking.length,
            }
        }

        await ctx.db.delete(args.presetId)
        return { ok: true as const }
    },
})
