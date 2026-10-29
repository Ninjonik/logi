import { normalizeUserDoc } from "../src/infrastructure/convex/server-read-model"
import { assertInternalSecret } from "./discord_shared"
import { mutation } from "./integrationMutation"
import { getUserByIdentifier } from "./identity"
import { query } from "./_generated/server"
import { v } from "convex/values"

export const getUsersByIds = query({
    args: {
        secret: v.string(),
        userIds: v.array(v.string()),
        guildId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const uniqueIds = [...new Set(args.userIds)]
        const users = await Promise.all(
            uniqueIds.map((userId) => getUserByIdentifier(ctx, userId))
        )

        return users
            .filter((user): user is NonNullable<typeof user> => Boolean(user))
            .map((user) => normalizeUserDoc(user, { guildId: args.guildId }))
    },
})

export const listUsers = query({
    args: {
        secret: v.string(),
        guildId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        return (await ctx.db.query("users").collect()).map((user) =>
            normalizeUserDoc(user, { guildId: args.guildId })
        )
    },
})

/** Trusted dashboard gateway has checked current clan admin access. */
export const updateServerDisplayName = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        discordId: v.string(),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const user = await getUserByIdentifier(ctx, args.discordId)
        if (!user || user.discordId !== args.discordId)
            throw new Error("Discord-linked player not found.")
        const name = args.name.trim()
        if (!name) throw new Error("Display name is required.")
        if (
            (user.nicknames?.[args.guildId]?.trim() || user.name.trim()) ===
            name
        )
            return { changed: false }
        await ctx.db.patch(user._id, {
            nicknames: { ...user.nicknames, [args.guildId]: name },
            updatedAt: new Date().toISOString(),
        })
        return { changed: true }
    },
})
