import {
    canAccessServerContext,
    canAdminServerContext,
    normalizeAssignmentDoc,
    normalizeCalendarItemDoc,
    normalizeDoc,
    normalizeEventDoc,
    normalizeGuildDoc,
    normalizeStratmapDoc,
    normalizeUserDoc,
} from "../src/infrastructure/convex/server-read-model"
import { filterByGameScope, type GameScope } from "../src/domain/games/game"
import { getGuildDiscordId, getUserByDiscordId } from "./identity"
import type { QueryCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { query } from "./_generated/server"
import { v } from "convex/values"

const INTERNAL_AUTH_SECRET =
    process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret"

function assertInternalSecret(secret: string) {
    if (secret !== INTERNAL_AUTH_SECRET) {
        throw new Error("Unauthorized.")
    }
}

async function buildServerContext(
    ctx: QueryCtx,
    args: { userId: string; serverId: Id<"guilds"> },
    options: {
        bypassAccessCheck: boolean
        forceAdmin: boolean
        gameScope?: GameScope
    }
) {
    const [user, server] = await Promise.all([
        getUserByDiscordId(ctx, args.userId),
        ctx.db.get(args.serverId),
    ])

    if (!user || !server) {
        return null
    }

    const serverDiscordId = getGuildDiscordId(server)
    const discordAccess = await ctx.db
        .query("discordMemberAccess")
        .withIndex("guildId_userId", (q) =>
            q.eq("guildId", serverDiscordId).eq("userId", args.userId)
        )
        .unique()

    if (
        !options.bypassAccessCheck &&
        !canAccessServerContext({
            user,
            userId: args.userId,
            serverDiscordId,
            serverAdminIds: server.adminIds,
            dashboardAdminIds: server.dashboardAdminIds,
            adminAccessOverrides: server.adminAccessOverrides,
            discordAccess,
        })
    ) {
        return null
    }

    const canAdmin = options.forceAdmin
        ? true
        : canAdminServerContext({
              serverAdminIds: server.adminIds,
              dashboardAdminIds: server.dashboardAdminIds,
              adminAccessOverrides: server.adminAccessOverrides,
              userId: args.userId,
              discordAccess,
          })
    const [
        events,
        topicPresets,
        squadPresets,
        stratmaps,
        groups,
        assignments,
        discordConfig,
        calendarItems,
    ] = await Promise.all([
        ctx.db
            .query("events")
            .withIndex("guildId", (q) => q.eq("guildId", serverDiscordId))
            .collect(),
        ctx.db
            .query("topicPresets")
            .withIndex("guildId", (q) => q.eq("guildId", serverDiscordId))
            .collect(),
        ctx.db
            .query("squadPresets")
            .withIndex("guildId", (q) => q.eq("guildId", serverDiscordId))
            .collect(),
        ctx.db
            .query("stratmaps")
            .withIndex("guildId", (q) => q.eq("guildId", serverDiscordId))
            .collect(),
        ctx.db
            .query("groups")
            .withIndex("guildId", (q) => q.eq("guildId", serverDiscordId))
            .collect(),
        ctx.db
            .query("userAssignments")
            .withIndex("serverId", (q) => q.eq("serverId", serverDiscordId))
            .collect(),
        ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", serverDiscordId))
            .unique(),
        ctx.db
            .query("calendarItems")
            .withIndex("guildId", (q) => q.eq("guildId", serverDiscordId))
            .collect(),
    ])
    const scopedEvents = filterByGameScope(events, options.gameScope)
    const scopedStratmaps = filterByGameScope(stratmaps, options.gameScope)
    const scopedGroups = filterByGameScope(groups, options.gameScope)
    const scopedAssignments = filterByGameScope(assignments, options.gameScope)
    const eventRosters = await Promise.all(
        scopedEvents.map((event) =>
            ctx.db
                .query("rosters")
                .withIndex("eventId", (q) => q.eq("eventId", event._id))
                .unique()
        )
    )
    const relevantRosters = eventRosters.filter(
        (roster): roster is NonNullable<typeof roster> => Boolean(roster)
    )
    const groupNameById = new Map(
        groups.map((group) => [String(group._id), group.name])
    )

    const normalizedServer = normalizeGuildDoc(server)

    return {
        user: normalizeUserDoc(user),
        server: {
            ...normalizedServer,
            calendarItems: calendarItems.map(normalizeCalendarItemDoc),
        },
        canAdmin,
        hasDashboardAccess: Boolean(discordAccess?.hasDashboardAccess),
        memberRoleIds: discordAccess?.roleIds ?? [],
        events: scopedEvents.map(normalizeEventDoc),
        topicPresets: topicPresets.map(normalizeDoc),
        squadPresets: squadPresets.map(normalizeDoc),
        stratmaps: scopedStratmaps.map(normalizeStratmapDoc),
        rosters: relevantRosters.map(normalizeDoc),
        groups: scopedGroups.map(normalizeDoc),
        assignments: scopedAssignments.map((assignment) =>
            normalizeAssignmentDoc(assignment, groupNameById)
        ),
        discordConfig: discordConfig ? normalizeDoc(discordConfig) : null,
    }
}

export const getServerContext = query({
    args: {
        userId: v.string(),
        serverId: v.id("guilds"),
        gameScope: v.optional(
            v.union(
                v.literal("all"),
                v.literal("hell_let_loose"),
                v.literal("hell_let_loose_vietnam"),
                v.literal("wardogs")
            )
        ),
    },
    handler: async (ctx, args) => {
        return await buildServerContext(ctx, args, {
            bypassAccessCheck: false,
            forceAdmin: false,
            gameScope: args.gameScope,
        })
    },
})

export const getServerContextInternal = query({
    args: {
        secret: v.string(),
        userId: v.string(),
        serverId: v.id("guilds"),
        gameScope: v.optional(
            v.union(
                v.literal("all"),
                v.literal("hell_let_loose"),
                v.literal("hell_let_loose_vietnam"),
                v.literal("wardogs")
            )
        ),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        return await buildServerContext(ctx, args, {
            bypassAccessCheck: true,
            forceAdmin: true,
            gameScope: args.gameScope,
        })
    },
})
