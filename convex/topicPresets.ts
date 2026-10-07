import { DISCORD_MESSAGE_MAX_ATTACHMENTS } from "../src/domain/discord-sync/attachment-limits"
import { eventsBlockingTopicPresetDeletion } from "../src/domain/events/preset-deletion"
import { getGuildById, getGuildDiscordId } from "./identity"
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
        const guildDiscordId = getGuildDiscordId(guild)

        const name = args.name.trim()
        if (!name) {
            throw new Error("Preset name is required.")
        }

        const topics = args.topics.map((item) => {
            const body = item.body?.trim() || undefined
            const attachments = item.attachments
                .map((attachment) => attachment.trim())
                .filter(Boolean)
            return {
                id: item.id?.trim() || crypto.randomUUID(),
                title: item.title.trim(),
                body,
                attachments,
                messages: item.messages?.map((message) => ({
                    id: message.id,
                    body: message.body?.trim() || undefined,
                    attachments: message.attachments
                        .map((attachment) => attachment.trim())
                        .filter(Boolean),
                })) ?? [{ id: crypto.randomUUID(), body, attachments }],
            }
        })

        if (!topics.length || topics.some((item) => !item.title)) {
            throw new Error("Every preset needs at least one named topic.")
        }
        if (
            topics.some(
                (item) =>
                    item.attachments.length > DISCORD_MESSAGE_MAX_ATTACHMENTS ||
                    item.messages.some(
                        (message) =>
                            message.attachments.length >
                            DISCORD_MESSAGE_MAX_ATTACHMENTS
                    )
            )
        ) {
            throw new Error(
                `A Discord message can have at most ${DISCORD_MESSAGE_MAX_ATTACHMENTS} attachments.`
            )
        }

        const payload = {
            guildId: guildDiscordId,
            name,
            side: args.side?.trim() || undefined,
            map: args.map?.trim() || undefined,
            cap: args.cap?.trim() || undefined,
            notes: args.notes?.trim() || undefined,
            topics,
            updatedAt: new Date().toISOString(),
        }

        if (args.presetId) {
            const existing = await ctx.db.get(args.presetId)
            if (!existing || existing.guildId !== guildDiscordId) {
                throw new Error("Topic preset not found.")
            }

            await ctx.db.patch(args.presetId, payload)
            return String(args.presetId)
        }

        const now = new Date().toISOString()
        const presetId = await ctx.db.insert("topicPresets", {
            ...payload,
            createdAt: now,
            updatedAt: now,
        })

        return String(presetId)
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
