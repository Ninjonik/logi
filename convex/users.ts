import { normalizeUserDoc } from "../src/infrastructure/convex/server-read-model"
import { assertInternalSecret } from "./discord_shared"
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
