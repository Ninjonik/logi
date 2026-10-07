import { sameServiceStates } from "../src/domain/discord-messages/service-status"
import { assertInternalSecret } from "./discord_shared"
import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const get = query({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        return await ctx.db.query("platformSettings").first()
    },
})

export const save = mutation({
    args: {
        secret: v.string(),
        workspaceGuildId: v.string(),
        statusChannelId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const now = new Date().toISOString()
        const existing = await ctx.db.query("platformSettings").first()
        const payload = {
            workspaceGuildId: args.workspaceGuildId.trim(),
            statusChannelId: args.statusChannelId?.trim() || undefined,
            updatedAt: now,
        }
        if (existing) {
            await ctx.db.patch(existing._id, {
                ...payload,
                statusMessageId:
                    existing.workspaceGuildId === payload.workspaceGuildId &&
                    existing.statusChannelId === payload.statusChannelId
                        ? existing.statusMessageId
                        : undefined,
                statusUpdatesThreadId:
                    existing.workspaceGuildId === payload.workspaceGuildId &&
                    existing.statusChannelId === payload.statusChannelId
                        ? existing.statusUpdatesThreadId
                        : undefined,
                serviceStates:
                    existing.workspaceGuildId === payload.workspaceGuildId
                        ? existing.serviceStates
                        : undefined,
            })
            return
        }
        await ctx.db.insert("platformSettings", payload)
    },
})

export const updateBotState = mutation({
    args: {
        secret: v.string(),
        statusMessageId: v.optional(v.string()),
        statusUpdatesThreadId: v.optional(v.string()),
        serviceStates: v.array(
            v.object({
                name: v.string(),
                online: v.boolean(),
                // When the service last changed state, for the outage
                // length in "Změny stavu" (board L5-37).
                since: v.optional(v.string()),
            })
        ),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const settings = await ctx.db.query("platformSettings").first()
        if (!settings) return
        // The bot checks every 30 s; an unchanged state is not stored again.
        if (
            settings.statusMessageId === args.statusMessageId &&
            settings.statusUpdatesThreadId === args.statusUpdatesThreadId &&
            sameServiceStates(settings.serviceStates, args.serviceStates)
        )
            return
        await ctx.db.patch(settings._id, {
            statusMessageId: args.statusMessageId,
            statusUpdatesThreadId: args.statusUpdatesThreadId,
            serviceStates: args.serviceStates,
            updatedAt: new Date().toISOString(),
        })
    },
})
