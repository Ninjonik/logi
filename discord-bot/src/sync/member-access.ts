import type { Client, GuildMember } from "discord.js"

import { convex, references } from "../convex"
import { revalidateAppData } from "../cache"
import type { SyncPayload } from "../types"
import { logInfo, logWarn } from "../log"
import { env } from "../environment"

/** Keeps explicit Logi admin assignments reflected in Discord's configured role. */
export async function syncDashboardAdminRoles(
    client: Client,
    payload: SyncPayload
) {
    const roleId = payload.config.dashboardAdminRoleId
    if (!roleId) return

    const guild = await client.guilds
        .fetch(payload.config.guildId)
        .catch(() => null)
    if (!guild) return

    const role = await guild.roles.fetch(roleId).catch(() => null)
    if (!role) {
        logWarn("member-access", "Dashboard admin role could not be fetched", {
            guildId: guild.id,
            roleId,
        })
        return
    }

    const overrides = payload.guild.adminAccessOverrides ?? {}
    await Promise.all(
        Object.entries(overrides).map(async ([userId, isAdmin]) => {
            const member = await guild.members.fetch(userId).catch(() => null)
            if (!member || member.roles.cache.has(roleId) === isAdmin) return

            await (
                isAdmin
                    ? member.roles.add(
                          role,
                          "Synced from Logi dashboard admin access"
                      )
                    : member.roles.remove(
                          role,
                          "Synced from Logi dashboard admin access"
                      )
            ).catch((error) => {
                logWarn(
                    "member-access",
                    "Failed to sync dashboard admin role",
                    {
                        guildId: guild.id,
                        userId,
                        roleId,
                        isAdmin,
                        error,
                    }
                )
            })
        })
    )
}

export async function syncGuildMemberAccess(
    client: Client,
    payload: SyncPayload
) {
    const guild = await client.guilds
        .fetch(payload.config.guildId)
        .catch(() => null)
    if (!guild) {
        logWarn(
            "member-access",
            "Skipping member access sync because guild could not be fetched",
            {
                guildId: payload.config.guildId,
            }
        )
        return
    }

    const members = await guild.members.fetch().catch(() => null)
    if (!members) {
        logWarn(
            "member-access",
            "Skipping member access sync because members could not be fetched",
            {
                guildId: payload.config.guildId,
            }
        )
        return
    }

    logInfo("member-access", "Syncing guild member access", {
        guildId: payload.config.guildId,
        memberCount: members.size,
    })

    await convex.mutation(references.syncMemberAccess, {
        secret: env.internalSecret,
        guildId: payload.config.guildId,
        members: members.map((member) => {
            const roleIds = [...member.roles.cache.keys()].filter(
                (roleId) => roleId !== guild.id
            )
            const isAdmin = member.permissions.has("Administrator")
            const hasDashboardAccess =
                isAdmin ||
                (payload.config.dashboardAdminRoleId
                    ? roleIds.includes(payload.config.dashboardAdminRoleId)
                    : false)

            return {
                userId: member.id,
                roleIds,
                isAdmin,
                hasDashboardAccess,
            }
        }),
    })
    await revalidateAppData({
        type: "server-context-changed",
        serverId: payload.config.guildId,
    })
}

export async function syncGuildMemberAccessMember(
    member: GuildMember,
    dashboardAdminRoleId?: string
) {
    const roleIds = [...member.roles.cache.keys()].filter(
        (roleId) => roleId !== member.guild.id
    )
    await convex.mutation(references.upsertMemberAccess, {
        secret: env.internalSecret,
        guildId: member.guild.id,
        userId: member.id,
        roleIds,
        isAdmin: member.permissions.has("Administrator"),
        hasDashboardAccess:
            member.permissions.has("Administrator") ||
            Boolean(
                dashboardAdminRoleId && roleIds.includes(dashboardAdminRoleId)
            ),
    })
}

export async function removeGuildMemberAccess(guildId: string, userId: string) {
    await convex.mutation(references.removeMemberAccess, {
        secret: env.internalSecret,
        guildId,
        userId,
    })
}
