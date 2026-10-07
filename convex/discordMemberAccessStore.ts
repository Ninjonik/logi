import type { MutationCtx } from "./_generated/server"

const sameRoles = (left: string[], right: string[]) => {
    const a = [...new Set(left)].sort(),
        b = [...new Set(right)].sort()
    return a.length === b.length && a.every((roleId, i) => roleId === b[i])
}

/**
 * Stores one member's dashboard access, and only when it changed: a
 * reconciliation passes every member of the clan, and a patch that changes
 * nothing still stores a new version of the row (ARCHITECTURE.md, "Convex
 * hot paths"). `updatedAt` is therefore the time the access last changed;
 * the last complete member sync is `membershipGuilds.lastFullSyncAt`.
 */
export async function upsertDiscordMemberCache(
    ctx: MutationCtx,
    guildId: string,
    member: {
        userId: string
        roleIds: string[]
        isAdmin: boolean
        hasDashboardAccess: boolean
    }
) {
    const existing = await ctx.db
        .query("discordMemberAccess")
        .withIndex("guildId_userId", (q) =>
            q.eq("guildId", guildId).eq("userId", member.userId)
        )
        .unique()
    const value = {
        userId: member.userId,
        roleIds: member.roleIds,
        isAdmin: member.isAdmin,
        hasDashboardAccess: member.hasDashboardAccess,
    }
    if (
        existing &&
        existing.isAdmin === value.isAdmin &&
        existing.hasDashboardAccess === value.hasDashboardAccess &&
        sameRoles(existing.roleIds, value.roleIds)
    )
        return existing._id
    const updatedAt = new Date().toISOString()
    if (existing) {
        await ctx.db.patch(existing._id, { ...value, updatedAt })
        return existing._id
    }
    return ctx.db.insert("discordMemberAccess", {
        guildId,
        ...value,
        updatedAt,
        createdAt: updatedAt,
    })
}

export async function syncDashboardAdminOverrides(
    ctx: MutationCtx,
    guildId: string,
    members: Array<{ userId: string; roleIds: string[] }>
) {
    const [guild, config] = await Promise.all([
        ctx.db
            .query("guilds")
            .withIndex("discordId", (q) => q.eq("discordId", guildId))
            .unique(),
        ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .unique(),
    ])
    const dashboardAdminRoleId = config?.dashboardAdminRoleId
    if (!guild || !dashboardAdminRoleId) return

    const overrides = { ...guild.adminAccessOverrides }
    let changed = false
    for (const member of members) {
        const hasRole = member.roleIds.includes(dashboardAdminRoleId)
        // Do not create false entries for every ordinary member. A false value is
        // only needed to remember an explicit Logi revocation.
        if (hasRole && overrides[member.userId] !== true) {
            overrides[member.userId] = true
            changed = true
        } else if (!hasRole && overrides[member.userId] !== undefined) {
            overrides[member.userId] = false
            changed = true
        }
    }
    if (changed) {
        await ctx.db.patch(guild._id, {
            adminAccessOverrides: overrides,
            updatedAt: new Date().toISOString(),
        })
    }
}
