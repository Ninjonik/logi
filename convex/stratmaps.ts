import { clientGrantScopes } from "../src/domain/identity/client-grant"
import { readClientGrant, verifyClientGrant } from "./clientGrants"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"

import {
    canAccessServerContext,
    canAdminServerContext,
    normalizeDoc,
    normalizeStratmapDoc,
} from "../src/infrastructure/convex/server-read-model"
import {
    getGuildByDiscordId,
    getGuildDiscordId,
    getGuildById,
    getUserByDiscordId,
} from "./identity"
import {
    findEventsLinkingStratmap,
    withoutStratmap,
} from "../src/domain/stratmaps/stratmap-references"
import {
    buildDefaultStratmapState,
    stringifyStratmapState,
} from "../src/lib/stratmaps"
import { assertInternalSecret } from "./discord_shared"

async function resolveGuildAccess(
    ctx: QueryCtx | MutationCtx,
    input: {
        userId: string
        guildDiscordId: string
    }
) {
    const [user, guild] = await Promise.all([
        getUserByDiscordId(ctx, input.userId),
        getGuildByDiscordId(ctx, input.guildDiscordId),
    ])

    if (!user || !guild) {
        return null
    }

    const discordAccess = await ctx.db
        .query("discordMemberAccess")
        .withIndex("guildId_userId", (q) =>
            q.eq("guildId", input.guildDiscordId).eq("userId", input.userId)
        )
        .unique()

    if (
        !canAccessServerContext({
            user,
            userId: input.userId,
            serverDiscordId: input.guildDiscordId,
            serverAdminIds: guild.adminIds,
            dashboardAdminIds: guild.dashboardAdminIds,
            adminAccessOverrides: guild.adminAccessOverrides,
            discordAccess,
        })
    ) {
        return null
    }

    return {
        guild,
        canAdmin: canAdminServerContext({
            serverAdminIds: guild.adminIds,
            dashboardAdminIds: guild.dashboardAdminIds,
            adminAccessOverrides: guild.adminAccessOverrides,
            userId: input.userId,
            discordAccess,
        }),
    }
}

export const listByGuild = query({
    args: {
        secret: v.string(),
        userId: v.string(),
        serverId: v.id("guilds"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const guild = await getGuildById(ctx, String(args.serverId))
        if (!guild) {
            return null
        }

        const guildDiscordId = getGuildDiscordId(guild)
        const access = await resolveGuildAccess(ctx, {
            userId: args.userId,
            guildDiscordId,
        })

        if (!access) {
            return null
        }

        const stratmaps = await ctx.db
            .query("stratmaps")
            .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
            .collect()

        return {
            canAdmin: access.canAdmin,
            stratmaps: stratmaps.map(normalizeStratmapDoc),
        }
    },
})

async function stratmapView(
    ctx: QueryCtx,
    userId: string,
    stratmapId: Id<"stratmaps">
) {
    const stratmap = await ctx.db.get(stratmapId)
    if (!stratmap) {
        return null
    }

    const access = await resolveGuildAccess(ctx, {
        userId,
        guildDiscordId: stratmap.guildId,
    })

    if (!access) {
        return null
    }

    return {
        canAdmin: access.canAdmin,
        serverId: String(access.guild._id),
        stratmap: normalizeStratmapDoc(stratmap),
    }
}

/** Server-side read for the signed-in user the web server resolved. */
export const getById = query({
    args: {
        secret: v.string(),
        userId: v.string(),
        stratmapId: v.id("stratmaps"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        return await stratmapView(ctx, args.userId, args.stratmapId)
    },
})

/** Live editor read; the viewer comes from a grant signed for this stratmap. */
export const getLiveById = query({
    args: {
        grant: v.string(),
        stratmapId: v.id("stratmaps"),
    },
    handler: async (ctx, args) => {
        const userId = await readClientGrant(
            ctx,
            args.grant,
            clientGrantScopes.stratmap(args.stratmapId)
        )
        return userId ? await stratmapView(ctx, userId, args.stratmapId) : null
    },
})

export const getPublicById = query({
    args: { secret: v.string(), stratmapId: v.id("stratmaps") },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const stratmap = await ctx.db.get(args.stratmapId)
        return stratmap ? normalizeStratmapDoc(stratmap) : null
    },
})

export const create = mutation({
    args: {
        grant: v.string(),
        serverId: v.id("guilds"),
        gameId: v.optional(
            v.union(
                v.literal("hell_let_loose"),
                v.literal("hell_let_loose_vietnam"),
                v.literal("wardogs")
            )
        ),
        title: v.string(),
        description: v.optional(v.string()),
        baseMapId: v.string(),
        side: v.optional(v.string()),
        strongpointId: v.optional(v.string()),
        eventId: v.optional(v.id("events")),
        state: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await verifyClientGrant(
            ctx,
            args.grant,
            clientGrantScopes.stratmapCreate(args.serverId)
        )
        const guild = await getGuildById(ctx, String(args.serverId))
        if (!guild) {
            throw new Error("Server not found.")
        }

        const guildDiscordId = getGuildDiscordId(guild)
        const access = await resolveGuildAccess(ctx, {
            userId,
            guildDiscordId,
        })

        if (!access?.canAdmin) {
            throw new Error("Only admins can create stratmaps.")
        }

        const now = new Date().toISOString()
        const stratmapId = await ctx.db.insert("stratmaps", {
            guildId: guildDiscordId,
            gameId: args.gameId,
            eventId: args.eventId,
            title: args.title.trim(),
            description: args.description?.trim() || undefined,
            baseMapId: args.baseMapId,
            side: args.side?.trim() || undefined,
            strongpointId: args.strongpointId?.trim() || undefined,
            state:
                args.state ??
                stringifyStratmapState(
                    buildDefaultStratmapState(args.baseMapId)
                ),
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
        })

        return String(stratmapId)
    },
})

export const updateMeta = mutation({
    args: {
        grant: v.string(),
        stratmapId: v.id("stratmaps"),
        title: v.string(),
        description: v.optional(v.string()),
        baseMapId: v.string(),
        side: v.optional(v.string()),
        strongpointId: v.optional(v.string()),
        eventId: v.optional(v.id("events")),
    },
    handler: async (ctx, args) => {
        const userId = await verifyClientGrant(
            ctx,
            args.grant,
            clientGrantScopes.stratmap(args.stratmapId)
        )
        const stratmap = await ctx.db.get(args.stratmapId)
        if (!stratmap) {
            throw new Error("Stratmap not found.")
        }

        const access = await resolveGuildAccess(ctx, {
            userId,
            guildDiscordId: stratmap.guildId,
        })

        if (!access?.canAdmin) {
            throw new Error("Only admins can edit stratmaps.")
        }

        await ctx.db.patch(args.stratmapId, {
            title: args.title.trim(),
            description: args.description?.trim() || undefined,
            baseMapId: args.baseMapId,
            side: args.side?.trim() || undefined,
            strongpointId: args.strongpointId?.trim() || undefined,
            eventId: args.eventId,
            updatedAt: new Date().toISOString(),
        })
    },
})

export const updateState = mutation({
    args: {
        grant: v.string(),
        stratmapId: v.id("stratmaps"),
        state: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await verifyClientGrant(
            ctx,
            args.grant,
            clientGrantScopes.stratmap(args.stratmapId)
        )
        const stratmap = await ctx.db.get(args.stratmapId)
        if (!stratmap) {
            throw new Error("Stratmap not found.")
        }

        const access = await resolveGuildAccess(ctx, {
            userId,
            guildDiscordId: stratmap.guildId,
        })

        if (!access?.canAdmin) {
            throw new Error("Only admins can edit stratmaps.")
        }

        await ctx.db.patch(args.stratmapId, {
            state: args.state,
            updatedAt: new Date().toISOString(),
        })
    },
})

/**
 * Deletes a stratmap for the signed-in clan administrator the web server
 * resolved, and removes it from every event of the clan that links it, so no
 * event keeps a link to a missing map. Uploaded slide and icon images stay in
 * storage.
 */
export const remove = mutation({
    args: {
        secret: v.string(),
        userId: v.string(),
        serverId: v.id("guilds"),
        stratmapId: v.id("stratmaps"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const guild = await getGuildById(ctx, String(args.serverId))
        const stratmap = await ctx.db.get(args.stratmapId)
        if (!guild || !stratmap) {
            return { ok: false as const, error: "not_found" as const }
        }

        const guildDiscordId = getGuildDiscordId(guild)
        if (stratmap.guildId !== guildDiscordId) {
            return { ok: false as const, error: "not_found" as const }
        }

        const access = await resolveGuildAccess(ctx, {
            userId: args.userId,
            guildDiscordId,
        })
        if (!access?.canAdmin) {
            return { ok: false as const, error: "forbidden" as const }
        }

        const events = await ctx.db
            .query("events")
            .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
            .collect()
        const linkingEvents = findEventsLinkingStratmap(
            events.map((event) => ({
                id: event._id,
                name: event.name,
                stratmapIds: event.stratmapIds,
            })),
            args.stratmapId
        )
        for (const event of linkingEvents) {
            await ctx.db.patch(event.id, {
                stratmapIds: withoutStratmap(
                    event.stratmapIds,
                    args.stratmapId
                ),
            })
        }

        await ctx.db.delete(args.stratmapId)
        return {
            ok: true as const,
            detachedEventIds: linkingEvents.map((event) => String(event.id)),
        }
    },
})
