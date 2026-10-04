import type { MutationCtx } from "./_generated/server"

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
    const updatedAt = new Date().toISOString()
    if (existing) await ctx.db.patch(existing._id, { ...member, updatedAt })
    else
        await ctx.db.insert("discordMemberAccess", {
            guildId,
            ...member,
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
