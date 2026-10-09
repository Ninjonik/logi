import {
    getGuildByDiscordId,
    getGuildDiscordId,
    getUserByDiscordId,
} from "./identity"
import { canAdminServerContext } from "../src/infrastructure/convex/server-read-model"
import { normalizeMatchTemplates } from "../src/domain/events/match-templates"
import { matchTemplateValidator } from "./matchTemplateValidators"
import { mutation, query } from "./_generated/server"
import { internalAuthSecret } from "./discord_shared"
import { v } from "convex/values"

export const DEFAULT_ROSTER_SCORE_SETTINGS = {
    noCategory: 0,
    declined: -1,
    rosterPresent: 0,
    reservePresent: 0,
    rosterAbsent: 0,
    reserveAbsent: 0,
    excusedAbsence: 0,
} as const

function assertInternalSecret(secret: string) {
    if (secret !== internalAuthSecret()) {
        throw new Error("Unauthorized.")
    }
}

function normalizeRosterScoreSettings(settings?: {
    noCategory: number
    declined: number
    rosterPresent: number
    reservePresent: number
    rosterAbsent: number
    reserveAbsent: number
    excusedAbsence: number
}) {
    return {
        noCategory: Number.isInteger(settings?.noCategory)
            ? (settings?.noCategory ?? DEFAULT_ROSTER_SCORE_SETTINGS.noCategory)
            : DEFAULT_ROSTER_SCORE_SETTINGS.noCategory,
        declined: Number.isInteger(settings?.declined)
            ? (settings?.declined ?? DEFAULT_ROSTER_SCORE_SETTINGS.declined)
            : DEFAULT_ROSTER_SCORE_SETTINGS.declined,
        rosterPresent: Number.isInteger(settings?.rosterPresent)
            ? (settings?.rosterPresent ??
              DEFAULT_ROSTER_SCORE_SETTINGS.rosterPresent)
            : DEFAULT_ROSTER_SCORE_SETTINGS.rosterPresent,
        reservePresent: Number.isInteger(settings?.reservePresent)
            ? (settings?.reservePresent ??
              DEFAULT_ROSTER_SCORE_SETTINGS.reservePresent)
            : DEFAULT_ROSTER_SCORE_SETTINGS.reservePresent,
        rosterAbsent: Number.isInteger(settings?.rosterAbsent)
            ? (settings?.rosterAbsent ??
              DEFAULT_ROSTER_SCORE_SETTINGS.rosterAbsent)
            : DEFAULT_ROSTER_SCORE_SETTINGS.rosterAbsent,
        reserveAbsent: Number.isInteger(settings?.reserveAbsent)
            ? (settings?.reserveAbsent ??
              DEFAULT_ROSTER_SCORE_SETTINGS.reserveAbsent)
            : DEFAULT_ROSTER_SCORE_SETTINGS.reserveAbsent,
        excusedAbsence: Number.isInteger(settings?.excusedAbsence)
            ? (settings?.excusedAbsence ??
              DEFAULT_ROSTER_SCORE_SETTINGS.excusedAbsence)
            : DEFAULT_ROSTER_SCORE_SETTINGS.excusedAbsence,
    }
}

function normalizeGuildDoc<
    T extends {
        _id: unknown
    },
>(guild: T) {
    return {
        ...guild,
        id: String(guild._id),
        discordId: getGuildDiscordId(guild),
    }
}

export const visibleForUser = query({
    args: {
        secret: v.string(),
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const user = await getUserByDiscordId(ctx, args.userId)

        if (!user) {
            return []
        }

        const ids = new Set<string>()
        if (user.guildId) ids.add(user.guildId)
        for (const id of user.managedGuildIds) ids.add(id)
        for (const id of user.mercenaryGuildIds) ids.add(id)

        const discordAccess = await ctx.db
            .query("discordMemberAccess")
            .withIndex("userId", (q) => q.eq("userId", args.userId))
            .collect()
        for (const access of discordAccess) {
            if (access.hasDashboardAccess) {
                ids.add(access.guildId)
            }
        }

        const directlyAssignedGuilds = (
            await ctx.db.query("guilds").collect()
        ).filter(
            (guild) =>
                guild.adminIds.includes(args.userId) ||
                guild.dashboardAdminIds?.includes(args.userId)
        )
        for (const guild of directlyAssignedGuilds) {
            ids.add(getGuildDiscordId(guild))
        }

        const adminGuildIds = new Set<string>(user.managedGuildIds)
        for (const access of discordAccess) {
            if (access.isAdmin) {
                adminGuildIds.add(access.guildId)
            }
        }

        const guilds = (
            await Promise.all(
                [...ids].map((guildId) => getGuildByDiscordId(ctx, guildId))
            )
        ).filter((guild): guild is NonNullable<typeof guild> => Boolean(guild))

        return guilds.map((guild) => ({
            ...normalizeGuildDoc(guild),
            canAdmin: canAdminServerContext({
                serverAdminIds: guild.adminIds,
                dashboardAdminIds: guild.dashboardAdminIds,
                adminAccessOverrides: guild.adminAccessOverrides,
                userId: args.userId,
                discordAccess: {
                    isAdmin: adminGuildIds.has(getGuildDiscordId(guild)),
                },
            }),
        }))
    },
})

export const syncManagedGuilds = mutation({
    args: {
        secret: v.string(),
        userId: v.string(),
        guilds: v.array(
            v.object({
                id: v.string(),
                name: v.string(),
                avatar: v.string(),
                botInside: v.boolean(),
            })
        ),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const user = await getUserByDiscordId(ctx, args.userId)

        if (!user) {
            throw new Error("Player not found.")
        }

        const now = new Date().toISOString()
        const managedGuildIds = args.guilds.map((guild) => guild.id)

        for (const guild of args.guilds) {
            const existing = await getGuildByDiscordId(ctx, guild.id)

            if (existing) {
                const adminIds = existing.adminIds.includes(args.userId)
                    ? existing.adminIds
                    : [...existing.adminIds, args.userId]

                await ctx.db.patch(existing._id, {
                    name: guild.name,
                    avatar: guild.avatar,
                    botInside: guild.botInside,
                    adminIds,
                    updatedAt: now,
                })

                const existingConfig = await ctx.db
                    .query("discordConfigs")
                    .withIndex("guildId", (q) => q.eq("guildId", guild.id))
                    .unique()
                if (!existingConfig) {
                    await ctx.db.insert("discordConfigs", {
                        guildId: guild.id,
                        timezone: "UTC",
                        defaultLanguage: "en",
                        createdAt: now,
                        updatedAt: now,
                    })
                }
                continue
            }

            await ctx.db.insert("guilds", {
                discordId: guild.id,
                id: guild.id,
                name: guild.name,
                avatar: guild.avatar,
                description: undefined,
                botInside: guild.botInside,
                adminIds: [args.userId],
                memberIds: [],
                members: [],
                mercenaryIds: [],
                createdAt: now,
                updatedAt: now,
            })

            await ctx.db.insert("discordConfigs", {
                guildId: guild.id,
                timezone: "UTC",
                defaultLanguage: "en",
                createdAt: now,
                updatedAt: now,
            })
        }

        const currentGuilds = await ctx.db.query("guilds").collect()
        for (const guild of currentGuilds) {
            if (!guild.adminIds.includes(args.userId)) {
                continue
            }

            if (managedGuildIds.includes(getGuildDiscordId(guild))) {
                continue
            }

            await ctx.db.patch(guild._id, {
                adminIds: guild.adminIds.filter((id) => id !== args.userId),
                updatedAt: now,
            })
        }

        await ctx.db.patch(user._id, {
            managedGuildIds,
            updatedAt: now,
        })

        return managedGuildIds
    },
})

export const getById = query({
    args: {
        secret: v.string(),
        guildId: v.id("guilds"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const guild = await ctx.db.get(args.guildId)

        return guild ? normalizeGuildDoc(guild) : null
    },
})

export const setEnabledGames = mutation({
    args: {
        secret: v.string(),
        userId: v.string(),
        guildId: v.id("guilds"),
        enabledGames: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const [guild, user] = await Promise.all([
            ctx.db.get(args.guildId),
            getUserByDiscordId(ctx, args.userId),
        ])
        if (!guild || !user) throw new Error("Server not found.")

        const guildId = getGuildDiscordId(guild)
        const access = await ctx.db
            .query("discordMemberAccess")
            .withIndex("guildId_userId", (q) =>
                q.eq("guildId", guildId).eq("userId", args.userId)
            )
            .unique()
        if (
            !canAdminServerContext({
                serverAdminIds: guild.adminIds,
                dashboardAdminIds: guild.dashboardAdminIds,
                adminAccessOverrides: guild.adminAccessOverrides,
                userId: args.userId,
                discordAccess: access,
            })
        ) {
            throw new Error("Only admins can change enabled games.")
        }

        const enabledGames = [...new Set(args.enabledGames)]
        await ctx.db.patch(guild._id, {
            enabledGames,
            updatedAt: new Date().toISOString(),
        })
    },
})

export const getByDiscordId = query({
    args: {
        secret: v.string(),
        discordId: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const guild = await getGuildByDiscordId(ctx, args.discordId)

        return guild ? normalizeGuildDoc(guild) : null
    },
})

export const resyncDashboardAdmins = mutation({
    args: {
        secret: v.string(),
        userId: v.string(),
        serverId: v.id("guilds"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const user = await getUserByDiscordId(ctx, args.userId)
        const guild = await ctx.db.get(args.serverId)
        if (!user || !guild) {
            throw new Error("Server not found.")
        }

        const guildDiscordId = getGuildDiscordId(guild)
        const discordAccess = await ctx.db
            .query("discordMemberAccess")
            .withIndex("guildId_userId", (q) =>
                q.eq("guildId", guildDiscordId).eq("userId", args.userId)
            )
            .unique()

        if (
            !discordAccess?.hasDashboardAccess &&
            !guild.adminIds.includes(args.userId)
        ) {
            throw new Error("Unauthorized.")
        }

        const accessRows = await ctx.db
            .query("discordMemberAccess")
            .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
            .collect()

        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
            .unique()
        const dashboardAdminRoleId = config?.dashboardAdminRoleId
        if (!dashboardAdminRoleId) {
            throw new Error("Configure a dashboard admin role first.")
        }

        const dashboardAdminIds = accessRows
            .filter((access) => access.roleIds.includes(dashboardAdminRoleId))
            .map((access) => access.userId)

        const adminAccessOverrides = { ...guild.adminAccessOverrides }
        const dashboardAdminIdSet = new Set(dashboardAdminIds)
        for (const userId of Object.keys(adminAccessOverrides)) {
            adminAccessOverrides[userId] = dashboardAdminIdSet.has(userId)
        }
        for (const userId of dashboardAdminIdSet) {
            adminAccessOverrides[userId] = true
        }

        await ctx.db.patch(guild._id, {
            adminAccessOverrides,
            updatedAt: new Date().toISOString(),
        })

        return {
            adminCount: dashboardAdminIds.length,
        }
    },
})

export const setPlayerAdminAccessInternal = mutation({
    args: {
        secret: v.string(),
        serverId: v.id("guilds"),
        playerId: v.string(),
        isAdmin: v.boolean(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const [guild, player] = await Promise.all([
            ctx.db.get(args.serverId),
            getUserByDiscordId(ctx, args.playerId),
        ])
        if (!guild || !player) {
            throw new Error("Player or server not found.")
        }

        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) =>
                q.eq("guildId", getGuildDiscordId(guild))
            )
            .unique()
        if (!config?.dashboardAdminRoleId) {
            throw new Error("Configure a dashboard admin role first.")
        }

        const adminAccessOverrides = {
            ...guild.adminAccessOverrides,
            [args.playerId]: args.isAdmin,
        }
        await ctx.db.patch(guild._id, {
            adminAccessOverrides,
            updatedAt: new Date().toISOString(),
        })
        return { isAdmin: args.isAdmin }
    },
})

export const listAllInternal = query({
    args: {
        secret: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const guilds = await ctx.db.query("guilds").collect()
        return guilds.map((guild) => ({
            ...normalizeGuildDoc(guild),
            canAdmin: true,
        }))
    },
})

export const updateFrontendSettings = mutation({
    args: {
        secret: v.string(),
        guildId: v.id("guilds"),
        name: v.string(),
        avatar: v.string(),
        description: v.optional(v.string()),
        eventCategories: v.optional(
            v.array(
                v.object({
                    id: v.string(),
                    label: v.string(),
                    color: v.string(),
                    emoji: v.optional(v.string()),
                })
            )
        ),
        calendarItems: v.optional(
            v.array(
                v.object({
                    id: v.string(),
                    title: v.string(),
                    description: v.optional(v.string()),
                    color: v.string(),
                    emoji: v.optional(v.string()),
                    label: v.optional(v.string()),
                    startAt: v.string(),
                    endAt: v.string(),
                    allDay: v.boolean(),
                    recurrence: v.optional(
                        v.object({
                            frequency: v.union(
                                v.literal("weekly"),
                                v.literal("monthly_date"),
                                v.literal("monthly_nth_weekday"),
                                v.literal("yearly")
                            ),
                            interval: v.number(),
                            until: v.optional(v.string()),
                        })
                    ),
                })
            )
        ),
        regenerateCalendarFeedToken: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const guild = await ctx.db.get(args.guildId)

        if (!guild) {
            throw new Error("Server not found.")
        }

        const now = new Date().toISOString()

        await ctx.db.patch(guild._id, {
            name: args.name.trim(),
            avatar: args.avatar.trim(),
            description: args.description?.trim() || undefined,
            eventCategories: (args.eventCategories ?? [])
                .map((category) => ({
                    id: category.id.trim(),
                    label: category.label.trim(),
                    color: category.color.trim(),
                    emoji: category.emoji?.trim() || undefined,
                }))
                .filter(
                    (category) =>
                        category.id && category.label && category.color
                ),
            updatedAt: now,
        })

        if (args.regenerateCalendarFeedToken) {
            const existingConfig = await ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) =>
                    q.eq("guildId", getGuildDiscordId(guild))
                )
                .unique()
            const calendarFeedToken = crypto.randomUUID().replace(/-/g, "")

            if (existingConfig) {
                await ctx.db.patch(existingConfig._id, {
                    calendarFeedToken,
                    updatedAt: now,
                })
            } else {
                await ctx.db.insert("discordConfigs", {
                    guildId: getGuildDiscordId(guild),
                    timezone: "UTC",
                    defaultLanguage: "en",
                    calendarFeedToken,
                    createdAt: now,
                    updatedAt: now,
                })
            }
        }

        const existingCalendarItems = await ctx.db
            .query("calendarItems")
            .withIndex("guildId", (q) =>
                q.eq("guildId", getGuildDiscordId(guild))
            )
            .collect()
        const normalizedCalendarItems = (args.calendarItems ?? [])
            .map((item) => ({
                id: item.id.trim(),
                title: item.title.trim(),
                description: item.description?.trim() || undefined,
                color: item.color.trim(),
                emoji: item.emoji?.trim() || undefined,
                label: item.label?.trim() || undefined,
                startAt: item.startAt,
                endAt: item.endAt,
                allDay: item.allDay,
                recurrence: item.recurrence
                    ? {
                          frequency: item.recurrence.frequency,
                          interval: Math.max(
                              1,
                              Math.floor(item.recurrence.interval)
                          ),
                          until: item.recurrence.until,
                      }
                    : undefined,
            }))
            .filter((item) => item.id && item.title && item.color)
        const nextIds = new Set(normalizedCalendarItems.map((item) => item.id))

        for (const existingItem of existingCalendarItems) {
            if (!nextIds.has(String(existingItem._id))) {
                await ctx.db.delete(existingItem._id)
            }
        }

        const existingById = new Map(
            existingCalendarItems.map((item) => [String(item._id), item])
        )
        for (const item of normalizedCalendarItems) {
            const existingItem = existingById.get(item.id)
            if (existingItem) {
                await ctx.db.patch(existingItem._id, {
                    title: item.title,
                    description: item.description,
                    color: item.color,
                    emoji: item.emoji,
                    label: item.label,
                    startAt: item.startAt,
                    endAt: item.endAt,
                    allDay: item.allDay,
                    recurrence: item.recurrence,
                    updatedAt: now,
                })
            } else {
                await ctx.db.insert("calendarItems", {
                    guildId: getGuildDiscordId(guild),
                    title: item.title,
                    description: item.description,
                    color: item.color,
                    emoji: item.emoji,
                    label: item.label,
                    startAt: item.startAt,
                    endAt: item.endAt,
                    allDay: item.allDay,
                    recurrence: item.recurrence,
                    createdAt: now,
                    updatedAt: now,
                })
            }
        }

        return String(guild._id)
    },
})

export const backfillRosterScoreSettings = mutation({
    args: {
        secret: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const now = new Date().toISOString()
        const configs = await ctx.db.query("discordConfigs").collect()
        let patchedCount = 0

        for (const config of configs) {
            const normalized = normalizeRosterScoreSettings(
                config.membershipSettings?.rosterScoreSettings
            )
            const alreadyNormalized =
                config.membershipSettings?.rosterScoreSettings?.noCategory ===
                    normalized.noCategory &&
                config.membershipSettings?.rosterScoreSettings?.declined ===
                    normalized.declined &&
                config.membershipSettings?.rosterScoreSettings
                    ?.rosterPresent === normalized.rosterPresent &&
                config.membershipSettings?.rosterScoreSettings
                    ?.reservePresent === normalized.reservePresent &&
                config.membershipSettings?.rosterScoreSettings?.rosterAbsent ===
                    normalized.rosterAbsent &&
                config.membershipSettings?.rosterScoreSettings
                    ?.reserveAbsent === normalized.reserveAbsent &&
                config.membershipSettings?.rosterScoreSettings
                    ?.excusedAbsence === normalized.excusedAbsence

            if (alreadyNormalized) {
                continue
            }

            await ctx.db.patch(config._id, {
                membershipSettings: config.membershipSettings
                    ? {
                          ...config.membershipSettings,
                          rosterScoreSettings: normalized,
                      }
                    : undefined,
                updatedAt: now,
            })
            patchedCount += 1
        }

        return {
            patchedCount,
        }
    },
})

/**
 * Replaces a clan's match templates. Signup groups and topic presets that do
 * not belong to this clan are dropped, so a template cannot point elsewhere.
 */
export const saveMatchTemplates = mutation({
    args: {
        secret: v.string(),
        guildId: v.id("guilds"),
        templates: v.array(matchTemplateValidator),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const guild = await ctx.db.get(args.guildId)
        if (!guild) {
            throw new Error("Server not found.")
        }
        const result = normalizeMatchTemplates(args.templates)
        if (!result.ok) return result

        const guildDiscordId = getGuildDiscordId(guild)
        const [groups, topicPresets] = await Promise.all([
            ctx.db
                .query("groups")
                .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
                .collect(),
            ctx.db
                .query("topicPresets")
                .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
                .collect(),
        ])
        const groupIds = new Set(groups.map((group) => String(group._id)))
        const topicPresetIds = new Set(
            topicPresets.map((preset) => String(preset._id))
        )
        const templates = result.templates.map((template) => ({
            ...template,
            signupGroupIds: template.signupGroupIds?.filter((groupId) =>
                groupIds.has(groupId)
            ),
            topicPresetId:
                template.topicPresetId &&
                topicPresetIds.has(template.topicPresetId)
                    ? template.topicPresetId
                    : undefined,
        }))

        await ctx.db.patch(guild._id, {
            matchTemplates: templates,
            updatedAt: new Date().toISOString(),
        })
        return { ok: true as const, templates }
    },
})
