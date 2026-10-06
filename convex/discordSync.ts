import {
    assertInternalSecret,
    normalizeConfigDoc,
    normalizeCalendarItemDoc,
    normalizeDoc,
    normalizeEventDoc,
    normalizeGuildDoc,
    normalizeUserDoc,
} from "./discord_shared"
import { matchesGameScope, withGameOverrides } from "../src/domain/games/game"
import { isDraftEvent, withoutDrafts } from "../src/domain/events/drafts"
import { syncDashboardAdminOverrides } from "./discordMemberAccessStore"
import { getGuildByDiscordId, getGuildDiscordId } from "./identity"
import { applyGatewayObservation } from "./memberObservations"
import { mutation } from "./integrationMutation"
import { query } from "./_generated/server"
import { v } from "convex/values"

/**
 * An event as the bot reads it, with the round of the competition fixture it
 * plays, so the calendar can say "ECL, 3. kolo" (L3-14).
 */
function withCompetitionRound(
    event: Parameters<typeof normalizeEventDoc>[0],
    rounds: ReadonlyMap<string, number>
) {
    const normalized = normalizeEventDoc(event)
    const round = rounds.get(normalized.id)
    return round === undefined
        ? normalized
        : { ...normalized, competitionRound: round }
}

export const listSyncPayloads = query({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const [
            guilds,
            configs,
            groups,
            events,
            calendarItems,
            topicPresets,
            syncStates,
            rosters,
            users,
            assignments,
            fixtures,
        ] = await Promise.all([
            ctx.db.query("guilds").collect(),
            ctx.db.query("discordConfigs").collect(),
            ctx.db.query("groups").collect(),
            ctx.db.query("events").collect(),
            ctx.db.query("calendarItems").collect(),
            ctx.db.query("topicPresets").collect(),
            ctx.db.query("discordEventSyncs").collect(),
            ctx.db.query("rosters").collect(),
            ctx.db.query("users").collect(),
            ctx.db.query("userAssignments").collect(),
            ctx.db.query("competitionFixtures").collect(),
        ])
        // L3-14: the calendar names a competition match's round.
        const rounds = new Map(
            fixtures.flatMap((fixture) =>
                fixture.eventId && typeof fixture.round === "number"
                    ? [[String(fixture.eventId), fixture.round] as const]
                    : []
            )
        )

        return configs.map((config) => {
            const normalizedUsers = users.map((user) =>
                normalizeUserDoc(user, { guildId: config.guildId })
            )
            const guild = guilds.find(
                (item) => getGuildDiscordId(item) === config.guildId
            )
            const guildGroups = groups
                .filter((group) => group.guildId === config.guildId)
                .map(normalizeDoc)
            // Drafts are not announced: the bot never sees them.
            const guildEvents = withoutDrafts(events)
                .filter((event) => event.guildId === config.guildId)
                .map((event) => withCompetitionRound(event, rounds))
            const guildCalendarItems = calendarItems
                .filter((item) => item.guildId === config.guildId)
                .map(normalizeCalendarItemDoc)
            const guildTopicPresets = topicPresets
                .filter((preset) => preset.guildId === config.guildId)
                .map(normalizeDoc)
            const guildSyncStates = syncStates
                .filter((state) => state.guildId === config.guildId)
                .map(normalizeDoc)
            const guildRosters = rosters
                .filter((roster) =>
                    guildEvents.some(
                        (event) => String(roster.eventId) === event.id
                    )
                )
                .map(normalizeDoc)
            const userIds = new Set<string>()

            for (const event of guildEvents) {
                for (const signUp of event.signUps ?? []) {
                    userIds.add(signUp.userId)
                }
                for (const participant of event.participants ?? []) {
                    userIds.add(participant.userId)
                }
            }

            const userDisplayNames = Object.fromEntries(
                normalizedUsers
                    .filter(
                        (user) =>
                            userIds.has(user.id) || userIds.has(user.discordId)
                    )
                    .flatMap((user) => {
                        const nickname =
                            user.nicknames?.[config.guildId]?.trim()
                        const displayName =
                            nickname ||
                            user.name?.trim() ||
                            user.discordId ||
                            user.id
                        return [
                            [user.id, displayName],
                            [user.discordId, displayName],
                        ] as const
                    })
            )

            return {
                guild: guild
                    ? normalizeGuildDoc(guild)
                    : {
                          id: config.guildId,
                          discordId: config.guildId,
                          name: config.guildId,
                          avatar: "",
                          botInside: false,
                          adminIds: [],
                          memberIds: [],
                          mercenaryIds: [],
                          eventCategories: [],
                          calendarItems: [],
                          updatedAt: config.updatedAt,
                      },
                config: normalizeConfigDoc(config),
                groups: guildGroups,
                userDisplayNames,
                events: guildEvents,
                calendarItems: guildCalendarItems,
                rosters: guildRosters,
                topicPresets: guildTopicPresets,
                syncStates: guildSyncStates,
                assignments: assignments
                    .filter(
                        (assignment) => assignment.serverId === config.guildId
                    )
                    .map((assignment) => ({
                        userId: assignment.userId,
                        type: assignment.type,
                        status: assignment.status,
                        gameId: assignment.gameId,
                    })),
            }
        })
    },
})

export const listGuildCacheSnapshot = query({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const [
            guilds,
            configs,
            groups,
            calendarItems,
            squadPresets,
            topicPresets,
            assignments,
        ] = await Promise.all([
            ctx.db.query("guilds").collect(),
            ctx.db.query("discordConfigs").collect(),
            ctx.db.query("groups").collect(),
            ctx.db.query("calendarItems").collect(),
            ctx.db.query("squadPresets").collect(),
            ctx.db.query("topicPresets").collect(),
            ctx.db.query("userAssignments").collect(),
        ])

        return {
            guilds: guilds.map(normalizeGuildDoc),
            configs: configs.map(normalizeConfigDoc),
            groups: groups.map(normalizeDoc),
            calendarItems: calendarItems.map(normalizeCalendarItemDoc),
            squadPresets: squadPresets.map(normalizeDoc),
            topicPresets: topicPresets.map(normalizeDoc),
            assignments: assignments.map((assignment) => ({
                userId: assignment.userId,
                type: assignment.type,
                status: assignment.status,
                gameId: assignment.gameId,
                serverId: assignment.serverId,
            })),
        }
    },
})

export const listEventSyncIndex = query({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const [events, rosters] = await Promise.all([
            ctx.db.query("events").collect(),
            ctx.db.query("rosters").collect(),
        ])

        return {
            events: withoutDrafts(events).map((event) => {
                const normalized = normalizeEventDoc(event)
                return {
                    id: normalized.id,
                    guildId: normalized.guildId,
                    status: normalized.status,
                    gameEnd: normalized.gameEnd,
                    updatedAt: normalized.updatedAt,
                }
            }),
            rosters: rosters.map((roster) => ({
                ...normalizeDoc(roster),
                eventId: String(roster.eventId),
            })),
        }
    },
})

export const getEventSyncContext = query({
    args: { secret: v.string(), eventId: v.id("events") },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const event = await ctx.db.get(args.eventId)
        if (!event || isDraftEvent(event)) {
            return null
        }

        const [roster, syncState, fixture] = await Promise.all([
            ctx.db
                .query("rosters")
                .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                .unique(),
            ctx.db
                .query("discordEventSyncs")
                .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                .unique(),
            ctx.db
                .query("competitionFixtures")
                .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                .first(),
        ])

        return {
            event: withCompetitionRound(
                event,
                new Map(
                    typeof fixture?.round === "number"
                        ? [[String(event._id), fixture.round]]
                        : []
                )
            ),
            roster: roster
                ? { ...normalizeDoc(roster), eventId: String(roster.eventId) }
                : null,
            syncState: syncState ? normalizeDoc(syncState) : null,
        }
    },
})

export const getEventSignupContext = query({
    args: {
        secret: v.string(),
        guildId: v.optional(v.string()),
        eventId: v.id("events"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const event = await ctx.db.get(args.eventId)
        if (
            !event ||
            isDraftEvent(event) ||
            (args.guildId && event.guildId !== args.guildId)
        ) {
            return null
        }
        const guildId = event.guildId
        const [config, groups, roster, assignments] = await Promise.all([
            ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .unique(),
            ctx.db
                .query("groups")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect(),
            ctx.db
                .query("rosters")
                .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                .unique(),
            ctx.db
                .query("userAssignments")
                .withIndex("serverId", (q) => q.eq("serverId", guildId))
                .collect(),
        ])

        if (!config) {
            return null
        }

        return {
            config: normalizeConfigDoc(
                withGameOverrides(config, config.gameOverrides, event.gameId)
            ),
            event: normalizeEventDoc(event),
            groups: groups.map(normalizeDoc),
            assignments: assignments
                .filter((assignment) =>
                    matchesGameScope(assignment.gameId, event.gameId)
                )
                .map((assignment) => ({
                    userId: assignment.userId,
                    primaryGroupId: assignment.primaryGroupId
                        ? String(assignment.primaryGroupId)
                        : undefined,
                    secondaryGroupIds: (assignment.secondaryGroupIds ?? []).map(
                        (groupId) => String(groupId)
                    ),
                    type: assignment.type,
                    status: assignment.status,
                })),
            roster: roster ? normalizeDoc(roster) : null,
        }
    },
})

export const getEventInteractionContext = query({
    args: { secret: v.string(), eventId: v.id("events") },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const event = await ctx.db.get(args.eventId)
        if (!event) {
            return null
        }

        const [config, groups, roster] = await Promise.all([
            ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", event.guildId))
                .unique(),
            ctx.db
                .query("groups")
                .withIndex("guildId", (q) => q.eq("guildId", event.guildId))
                .collect(),
            ctx.db
                .query("rosters")
                .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                .unique(),
        ])

        if (!config) {
            return null
        }
        // The event category colour keeps private replies in the card's colour.
        const guild = await getGuildByDiscordId(ctx, event.guildId)
        const matchType = event.matchType?.trim().toLowerCase()
        const categoryColor =
            (matchType &&
                guild?.eventCategories?.find(
                    (category) => category.id.trim().toLowerCase() === matchType
                )?.color) ||
            null

        return {
            config: normalizeConfigDoc(
                withGameOverrides(config, config.gameOverrides, event.gameId)
            ),
            event: normalizeEventDoc(event),
            groups: groups.map(normalizeDoc),
            roster: roster ? normalizeDoc(roster) : null,
            categoryColor,
        }
    },
})

/** Marks an existing forum-backed event for a fresh topic-template sync. */
export const requestForumTopicResync = mutation({
    args: { secret: v.string(), eventId: v.id("events") },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const event = await ctx.db.get(args.eventId)
        if (!event) throw new Error("Event not found.")
        if (event.status === "concluded")
            throw new Error("Concluded events cannot be resynced.")
        if (!event.createForumChannel || !event.topicPresetId) {
            throw new Error("This event does not have a forum topic template.")
        }

        const [preset, syncState] = await Promise.all([
            ctx.db.get(event.topicPresetId),
            ctx.db
                .query("discordEventSyncs")
                .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                .unique(),
        ])
        if (!preset || preset.guildId !== event.guildId)
            throw new Error("Topic preset not found.")
        if (!syncState?.forumChannelId)
            throw new Error("This event does not have a forum channel yet.")

        await ctx.db.patch(args.eventId, {
            updatedAt: new Date().toISOString(),
        })
        return { ok: true as const }
    },
})

export const updateEventSyncState = mutation({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
        guildId: v.string(),
        announcementChannelId: v.optional(v.string()),
        announcementMessageId: v.optional(v.string()),
        eventInfoMessageId: v.optional(v.string()),
        eventInfoMessageRenderVersion: v.optional(v.string()),
        scheduledEventId: v.optional(v.string()),
        scheduledEventStatus: v.optional(
            v.union(
                v.literal("scheduled"),
                v.literal("active"),
                v.literal("completed"),
                v.literal("canceled")
            )
        ),
        forumChannelId: v.optional(v.string()),
        forumThreadId: v.optional(v.string()),
        infoMessageId: v.optional(v.string()),
        topicMessageIds: v.array(v.string()),
        lastEventUpdatedAt: v.optional(v.string()),
        lastRosterUpdatedAt: v.optional(v.string()),
        lastConfigUpdatedAt: v.optional(v.string()),
        lastCalendarSyncVersion: v.optional(v.string()),
        squadVoiceChannelIds: v.optional(v.array(v.string())),
        lastSyncedAt: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const now = new Date().toISOString()
        const payload = {
            guildId: args.guildId,
            announcementChannelId: args.announcementChannelId,
            announcementMessageId: args.announcementMessageId,
            eventInfoMessageId: args.eventInfoMessageId,
            eventInfoMessageRenderVersion: args.eventInfoMessageRenderVersion,
            scheduledEventId: args.scheduledEventId,
            scheduledEventStatus: args.scheduledEventStatus,
            forumChannelId: args.forumChannelId,
            forumThreadId: args.forumThreadId,
            infoMessageId: args.infoMessageId,
            topicMessageIds: args.topicMessageIds,
            lastEventUpdatedAt: args.lastEventUpdatedAt,
            lastRosterUpdatedAt: args.lastRosterUpdatedAt,
            lastConfigUpdatedAt: args.lastConfigUpdatedAt,
            lastCalendarSyncVersion: args.lastCalendarSyncVersion,
            squadVoiceChannelIds: args.squadVoiceChannelIds,
            lastSyncedAt: args.lastSyncedAt,
            updatedAt: now,
        }

        const existing = await ctx.db
            .query("discordEventSyncs")
            .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
            .unique()

        if (existing) {
            await ctx.db.patch(existing._id, payload)
            return String(existing._id)
        }

        const stateId = await ctx.db.insert("discordEventSyncs", {
            eventId: args.eventId,
            ...payload,
            createdAt: now,
        })

        return String(stateId)
    },
})

export const updateRosterUpdateMessage = mutation({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
        guildId: v.string(),
        channelId: v.string(),
        messageId: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const existing = await ctx.db
            .query("discordEventSyncs")
            .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
            .unique()
        if (!existing) return null
        await ctx.db.patch(existing._id, {
            rosterUpdateChannelId: args.channelId,
            rosterUpdateMessageId: args.messageId,
            updatedAt: new Date().toISOString(),
        })
        return String(existing._id)
    },
})

export const syncMemberAccess = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        members: v.array(
            v.object({
                userId: v.string(),
                roleIds: v.array(v.string()),
                voiceChannelId: v.optional(v.string()),
                isAdmin: v.boolean(),
                hasDashboardAccess: v.boolean(),
            })
        ),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const now = new Date().toISOString()
        const existing = await ctx.db
            .query("discordMemberAccess")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .collect()
        const existingByUserId = new Map(
            existing.map((item) => [item.userId, item])
        )
        const nextUserIds = new Set(args.members.map((member) => member.userId))

        for (const member of args.members) {
            const current = existingByUserId.get(member.userId)
            if (current) {
                await ctx.db.patch(current._id, {
                    roleIds: member.roleIds,
                    voiceChannelId: member.voiceChannelId,
                    isAdmin: member.isAdmin,
                    hasDashboardAccess: member.hasDashboardAccess,
                    updatedAt: now,
                })
            } else {
                await ctx.db.insert("discordMemberAccess", {
                    guildId: args.guildId,
                    userId: member.userId,
                    roleIds: member.roleIds,
                    voiceChannelId: member.voiceChannelId,
                    isAdmin: member.isAdmin,
                    hasDashboardAccess: member.hasDashboardAccess,
                    createdAt: now,
                    updatedAt: now,
                })
            }
        }

        for (const stale of existing) {
            if (!nextUserIds.has(stale.userId)) {
                await ctx.db.delete(stale._id)
            }
        }

        await syncDashboardAdminOverrides(ctx, args.guildId, args.members)

        return { ok: true }
    },
})

export const upsertMemberAccess = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        userId: v.string(),
        roleIds: v.array(v.string()),
        isAdmin: v.boolean(),
        hasDashboardAccess: v.boolean(),
        observation: v.optional(
            v.object({ epoch: v.string(), observedAt: v.string() })
        ),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        if (
            args.observation &&
            !(await applyGatewayObservation(ctx, {
                guildId: args.guildId,
                discordUserId: args.userId,
                state: "present",
                roleIds: args.roleIds,
                ...args.observation,
            }))
        )
            return null
        const now = new Date().toISOString()
        const existing = await ctx.db
            .query("discordMemberAccess")
            .withIndex("guildId_userId", (q) =>
                q.eq("guildId", args.guildId).eq("userId", args.userId)
            )
            .unique()
        const patch = {
            roleIds: args.roleIds,
            isAdmin: args.isAdmin,
            hasDashboardAccess: args.hasDashboardAccess,
            updatedAt: now,
        }
        let id: string
        if (existing) {
            await ctx.db.patch(existing._id, patch)
            id = String(existing._id)
        } else {
            id = String(
                await ctx.db.insert("discordMemberAccess", {
                    guildId: args.guildId,
                    userId: args.userId,
                    ...patch,
                    createdAt: now,
                })
            )
        }
        await syncDashboardAdminOverrides(ctx, args.guildId, [args])
        return id
    },
})

export const removeMemberAccess = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        userId: v.string(),
        observation: v.optional(
            v.object({ epoch: v.string(), observedAt: v.string() })
        ),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        if (
            args.observation &&
            !(await applyGatewayObservation(ctx, {
                guildId: args.guildId,
                discordUserId: args.userId,
                state: "left",
                roleIds: [],
                ...args.observation,
            }))
        )
            return
        const existing = await ctx.db
            .query("discordMemberAccess")
            .withIndex("guildId_userId", (q) =>
                q.eq("guildId", args.guildId).eq("userId", args.userId)
            )
            .unique()
        if (existing) await ctx.db.delete(existing._id)
    },
})
