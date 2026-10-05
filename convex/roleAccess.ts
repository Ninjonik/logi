import {
    dashboardManagers,
    roleMemberCounts,
} from "../src/domain/workspaces/role-access"
import { getGuildDiscordId, getUserByDiscordId } from "./identity"
import { assertInternalSecret } from "./discord_shared"
import { query } from "./_generated/server"
import { v } from "convex/values"

/** Enough for any clan's manager list; larger lists are cut. */
const MANAGER_LIMIT = 50

/**
 * Roles and access overview of one clan (Settings, Roles and access): how
 * many members hold each Discord role and who can manage Logi now, from the
 * member access the bot stores. Server callers check the session and the
 * clan admin right first; everything is scoped to this clan's Discord server.
 */
export const getOverview = query({
    args: {
        secret: v.string(),
        serverId: v.id("guilds"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const guild = await ctx.db.get(args.serverId)
        if (!guild) return null
        const guildId = getGuildDiscordId(guild)
        const [rows, config, runs] = await Promise.all([
            ctx.db
                .query("discordMemberAccess")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect(),
            ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .unique(),
            ctx.db
                .query("membershipSyncRuns")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect(),
        ])
        const managers = dashboardManagers({
            rows,
            serverAdminIds: guild.adminIds,
            adminAccessOverrides: guild.adminAccessOverrides,
            managerRoleId: config?.dashboardAdminRoleId,
        })
        const listed = await Promise.all(
            managers.slice(0, MANAGER_LIMIT).map(async (manager) => {
                const user = await getUserByDiscordId(ctx, manager.userId)
                return {
                    ...manager,
                    name: user?.nicknames?.[guildId]?.trim() || user?.name,
                    avatar: user?.avatar,
                }
            })
        )
        // The last complete member sync; single updates move rows too.
        const lastSync = runs
            .filter((run) => run.status === "complete")
            .map((run) => run.observedAt)
            .sort()
            .at(-1)
        const lastUpdate = rows
            .map((row) => row.updatedAt)
            .sort()
            .at(-1)
        return {
            members: rows.length,
            roleCounts: roleMemberCounts(rows),
            managers: listed,
            managerCount: managers.length,
            updatedAt:
                [lastSync, lastUpdate]
                    .filter((value): value is string => Boolean(value))
                    .sort()
                    .at(-1) ?? null,
        }
    },
})
