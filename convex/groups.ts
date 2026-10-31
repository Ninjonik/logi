import { ConvexGroupRepository } from "../src/infrastructure/convex/group-repository"
import { GroupCommands } from "../src/application/groups/group-commands"
import { getGuildById, getGuildDiscordId } from "./identity"
import { matchesGameScope } from "../src/domain/games/game"
import { systemClock } from "../src/domain/shared/clock"
import { internalAuthSecret } from "./discord_shared"
import { mutation } from "./integrationMutation"
import { query } from "./_generated/server"
import { v } from "convex/values"

function assertInternalSecret(secret: string) {
    if (secret !== internalAuthSecret()) {
        throw new Error("Unauthorized.")
    }
}

function normalizeDoc<T extends { _id: unknown }>(doc: T) {
    return {
        ...doc,
        id: String(doc._id),
    }
}

export const listForGuild = query({
    args: {
        secret: v.string(),
        guildId: v.id("guilds"),
        gameScope: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const guild = await getGuildById(ctx, args.guildId)
        if (!guild) {
            return []
        }
        const groups = await ctx.db
            .query("groups")
            .withIndex("guildId", (q) =>
                q.eq("guildId", getGuildDiscordId(guild))
            )
            .collect()
        return groups
            .filter((group) => matchesGameScope(group.gameId, args.gameScope))
            .map(normalizeDoc)
    },
})

export const getById = query({
    args: {
        secret: v.string(),
        groupId: v.id("groups"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const group = await ctx.db.get(args.groupId)
        return group ? normalizeDoc(group) : null
    },
})

export const upsert = mutation({
    args: {
        secret: v.string(),
        guildId: v.id("guilds"),
        groupId: v.optional(v.id("groups")),
        gameId: v.optional(v.string()),
        name: v.string(),
        color: v.string(),
        order: v.number(),
        parentId: v.optional(v.id("groups")),
        description: v.optional(v.string()),
        discordRoleId: v.optional(v.string()),
        discordEmoji: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const guild = await getGuildById(ctx, args.guildId)
        if (!guild) throw new Error("Server not found.")
        const saved = await new GroupCommands(
            new ConvexGroupRepository(ctx),
            systemClock
        ).save({ ...args, guildId: getGuildDiscordId(guild) })
        return saved.id
    },
})

export const remove = mutation({
    args: {
        secret: v.string(),
        guildId: v.id("guilds"),
        groupId: v.id("groups"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const guild = await getGuildById(ctx, args.guildId)
        if (!guild) {
            throw new Error("Server not found.")
        }
        await new GroupCommands(
            new ConvexGroupRepository(ctx),
            systemClock
        ).remove(getGuildDiscordId(guild), args.groupId)
    },
})
