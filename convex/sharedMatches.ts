import {
    sharedMatchMembers,
    sharedMatchPatch,
    sharedMatchPeople,
    synchronizeSharedMatch,
} from "../src/infrastructure/convex/shared-match-store"
import { refreshSharedMatchPresentation } from "../src/infrastructure/convex/shared-match-logos"
import { configureSharedMatchLocal } from "../src/infrastructure/convex/configure-shared-match"
import { syncEventAssetReferences } from "../src/infrastructure/convex/event-asset-references"
import { refreshEventSchedule } from "../src/infrastructure/convex/event-scheduling"
import { normalizeUserDoc } from "../src/infrastructure/convex/server-read-model"
import { withGameOverrides, resolveGameScope } from "../src/domain/games/game"
import { sharedRosterUser } from "../src/domain/rosters/shared-roster-user"
import { sharedRegistrationStart } from "../src/domain/events/shared-match"
import { validateRequestedRoles } from "../src/domain/events/shared-match"
import { dashboardActor, authorizeDashboardAdmin } from "./dashboardActor"
import { eventDiscussionDefaults } from "../src/domain/events/discussion"
import { debriefDestinationValidator } from "./eventDiscussionValidators"
import { eventDiscordDeletion } from "../src/domain/events/deletion"
import { getUserByDiscordId, getGuildByDiscordId } from "./identity"
import { currentEventStatus } from "../src/domain/events/status"
import { queueEventDiscordDeletion } from "./eventDeletionQueue"
import { assertInternalSecret } from "./discord_shared"
import { mutation } from "./integrationMutation"
import { getGuildDiscordId } from "./identity"
import { query } from "./_generated/server"
import { v } from "convex/values"

const scope = { secret: v.string(), guildId: v.string(), actor: dashboardActor }
const requestedRole = v.object({ role: v.string(), count: v.number() })

export const cacheScopes = query({
    args: { secret: v.string(), resourceId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const eventId = ctx.db.normalizeId("events", args.resourceId)
        const rosterId = ctx.db.normalizeId("rosters", args.resourceId)
        const roster = rosterId ? await ctx.db.get(rosterId) : null
        const event = eventId
            ? await ctx.db.get(eventId)
            : roster
              ? await ctx.db.get(roster.eventId)
              : null
        if (!event) return []
        const host = event.hostEventId
            ? await ctx.db.get(event.hostEventId)
            : event
        if (!host) return []
        const invitations = await ctx.db
            .query("sharedMatchInvitations")
            .withIndex("hostEventId", (q) => q.eq("hostEventId", host._id))
            .collect()
        if (!invitations.length) return []
        return Promise.all(
            [
                host,
                ...(
                    await Promise.all(
                        invitations.flatMap((item) =>
                            item.localEventId
                                ? [ctx.db.get(item.localEventId)]
                                : []
                        )
                    )
                ).filter((item) => item !== null),
            ].map(async (item) => {
                const [server, localRoster] = await Promise.all([
                    getGuildByDiscordId(ctx, item.guildId),
                    ctx.db
                        .query("rosters")
                        .withIndex("eventId", (q) => q.eq("eventId", item._id))
                        .unique(),
                ])
                if (!server) throw new Error("Participating clan not found.")
                return {
                    serverId: String(server._id),
                    guildId: item.guildId,
                    eventId: String(item._id),
                    rosterId: localRoster ? String(localRoster._id) : undefined,
                }
            })
        )
    },
})

export const list = query({
    args: { ...scope, eventId: v.optional(v.id("events")) },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const incoming = await ctx.db
            .query("sharedMatchInvitations")
            .withIndex("guestGuildId", (q) =>
                q.eq("guestGuildId", args.guildId)
            )
            .collect()
        const event = args.eventId ? await ctx.db.get(args.eventId) : null
        if (args.eventId && (!event || event.guildId !== args.guildId))
            throw new Error("Event not found.")
        const hostId = event?.hostEventId ?? event?._id
        const invitations = hostId
            ? await ctx.db
                  .query("sharedMatchInvitations")
                  .withIndex("hostEventId", (q) => q.eq("hostEventId", hostId))
                  .collect()
            : []
        const enrich = async (item: (typeof incoming)[number]) => {
            const [host, guest, match] = await Promise.all([
                getGuildByDiscordId(ctx, item.hostGuildId),
                getGuildByDiscordId(ctx, item.guestGuildId),
                ctx.db.get(item.hostEventId),
            ])
            return {
                id: String(item._id),
                ...item,
                hostName: host?.name ?? item.hostGuildId,
                guestName: guest?.name ?? item.guestGuildId,
                matchName: match?.name ?? "",
                gameStart: match?.gameStart,
            }
        }
        return {
            incoming: await Promise.all(
                incoming.filter((item) => item.status === "pending").map(enrich)
            ),
            invitations: await Promise.all(invitations.map(enrich)),
        }
    },
})

export const searchClans = query({
    args: { ...scope, search: v.string() },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        if (args.search.trim().length < 2) return []
        const clans = await ctx.db
            .query("guilds")
            .withSearchIndex("name", (q) =>
                q.search("name", args.search.trim())
            )
            .take(20)
        return clans
            .filter((clan) => getGuildDiscordId(clan) !== args.guildId)
            .map((clan) => ({
                guildId: getGuildDiscordId(clan),
                name: clan.name,
            }))
    },
})

export const invite = mutation({
    args: {
        ...scope,
        eventId: v.id("events"),
        guestGuildId: v.string(),
        requestedRoles: v.array(requestedRole),
    },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const event = await ctx.db.get(args.eventId)
        if (
            !event ||
            event.guildId !== args.guildId ||
            event.hostEventId ||
            event.kind === "training" ||
            event.isDraft ||
            currentEventStatus(event) === "concluded"
        )
            throw new Error(
                "Only the host can invite clans to an active published match."
            )
        const roles = validateRequestedRoles(args.requestedRoles)
        const guest = await getGuildByDiscordId(ctx, args.guestGuildId)
        if (!guest || args.guestGuildId === args.guildId)
            throw new Error("Choose another clan using Logi.")
        if (
            !(guest.enabledGames ?? ["hell_let_loose"]).includes(
                resolveGameScope(event.gameId)
            )
        )
            throw new Error(
                "The invited clan must enable this match's game first."
            )
        const existing = await ctx.db
            .query("sharedMatchInvitations")
            .withIndex("host_guest", (q) =>
                q
                    .eq("hostEventId", event._id)
                    .eq("guestGuildId", args.guestGuildId)
            )
            .unique()
        const all = await ctx.db
            .query("sharedMatchInvitations")
            .withIndex("hostEventId", (q) => q.eq("hostEventId", event._id))
            .collect()
        if (!existing && all.length >= 20)
            throw new Error("A match can invite up to 20 clans.")
        const now = new Date().toISOString()
        if (existing) {
            await ctx.db.patch(existing._id, {
                requestedRoles: roles,
                status: existing.status === "accepted" ? "accepted" : "pending",
                updatedAt: now,
            })
            return String(existing._id)
        }
        return String(
            await ctx.db.insert("sharedMatchInvitations", {
                hostEventId: event._id,
                hostGuildId: args.guildId,
                guestGuildId: args.guestGuildId,
                requestedRoles: roles,
                status: "pending",
                createdAt: now,
                updatedAt: now,
            })
        )
    },
})

export const respond = mutation({
    args: {
        ...scope,
        invitationId: v.id("sharedMatchInvitations"),
        accept: v.boolean(),
        registrationStart: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const invitation = await ctx.db.get(args.invitationId)
        if (
            !invitation ||
            invitation.guestGuildId !== args.guildId ||
            invitation.status !== "pending"
        )
            throw new Error("Invitation unavailable.")
        const now = new Date().toISOString()
        if (!args.accept) {
            await ctx.db.patch(invitation._id, {
                status: "declined",
                updatedAt: now,
            })
            return null
        }
        const host = await ctx.db.get(invitation.hostEventId)
        if (
            !host ||
            host.hostEventId ||
            host.isDraft ||
            host.kind === "training" ||
            currentEventStatus(host) === "concluded"
        )
            throw new Error("Host match unavailable.")
        const guestClan = await getGuildByDiscordId(ctx, args.guildId)
        if (
            args.accept &&
            !(guestClan?.enabledGames ?? ["hell_let_loose"]).includes(
                resolveGameScope(host.gameId)
            )
        )
            throw new Error(
                "Enable the match's game before accepting this invitation."
            )
        const hostClan = await getGuildByDiscordId(ctx, host.guildId)
        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .unique()
        const local = config
            ? withGameOverrides(config, config.gameOverrides, host.gameId)
            : null
        const localEventId = await ctx.db.insert("events", {
            name: host.name,
            registrationEnd: host.registrationEnd,
            meetingStart: host.meetingStart,
            gameStart: host.gameStart,
            gameEnd: host.gameEnd,
            ...sharedMatchPatch(host),
            registrationStart: sharedRegistrationStart(
                args.registrationStart ?? host.registrationStart,
                host.registrationEnd
            ),
            hostEventId: host._id,
            hostClanName: hostClan?.name ?? host.guildId,
            guildId: args.guildId,
            pingClan: false,
            pingMode: "none",
            createdAt: now,
            updatedAt: now,
            announcementChannelId: local?.announcementsChannelId,
            eventInfoChannelId: local?.eventInfoChannelId,
            eventResultsChannelId: local?.eventResultsChannelId,
            meetingChannelId: local?.meetingChannelId,
            squadVoiceCategoryId: local?.squadVoiceCategoryId,
            useGeneralSignup: true,
            ...eventDiscussionDefaults(config, resolveGameScope(host.gameId)),
        })
        await ctx.db.patch(invitation._id, {
            status: "accepted",
            localEventId,
            updatedAt: now,
        })
        await refreshSharedMatchPresentation(ctx, host, now)
        const createdEvent = await ctx.db.get(localEventId)
        if (createdEvent) await syncEventAssetReferences(ctx, createdEvent)
        await refreshEventSchedule(ctx, localEventId)
        await synchronizeSharedMatch(ctx, host._id)
        return String(localEventId)
    },
})

export const rosterContext = query({
    args: { ...scope, eventId: v.id("events") },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const event = await ctx.db.get(args.eventId)
        if (!event || event.guildId !== args.guildId)
            throw new Error("Event not found.")
        const { host, events } = await sharedMatchMembers(ctx, event)
        const { owners, eligibleByGuild } = await sharedMatchPeople(ctx, events)
        const clans = await Promise.all(
            events.map(async (item) => {
                const clan = await getGuildByDiscordId(ctx, item.guildId)
                return {
                    guildId: item.guildId,
                    name: clan?.name ?? item.guildId,
                    avatar: clan?.avatar,
                }
            })
        )
        const visibleRoster = event.hostEventId
            ? await ctx.db
                  .query("rosters")
                  .withIndex("eventId", (q) => q.eq("eventId", host._id))
                  .unique()
            : null
        const visiblePlayerIds = new Set(
            visibleRoster?.squads.flatMap((squad) =>
                squad.players.flatMap((slot) => (slot.id ? [slot.id] : []))
            ) ?? []
        )
        const users = await Promise.all(
            [...owners]
                .filter(
                    ([id]) =>
                        !event.hostEventId ||
                        eligibleByGuild.get(args.guildId)?.has(id) ||
                        visiblePlayerIds.has(id)
                )
                .map(async ([id, ownerGuildId]) => {
                    const guildId =
                        event.hostEventId &&
                        eligibleByGuild.get(args.guildId)?.has(id)
                            ? args.guildId
                            : ownerGuildId
                    const user = await getUserByDiscordId(ctx, id)
                    return user
                        ? {
                              ...sharedRosterUser(
                                  normalizeUserDoc(user, { guildId }),
                                  guildId === args.guildId
                              ),
                              sharedGuildId: guildId,
                              sharedEligibleGuildIds: events
                                  .filter((item) =>
                                      eligibleByGuild.get(item.guildId)?.has(id)
                                  )
                                  .map((item) => item.guildId),
                          }
                        : null
                })
        )
        return {
            hostGuildId: host.guildId,
            clans,
            users: users.filter((item) => item !== null),
        }
    },
})

export const revoke = mutation({
    args: { ...scope, invitationId: v.id("sharedMatchInvitations") },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const invitation = await ctx.db.get(args.invitationId)
        if (!invitation || invitation.hostGuildId !== args.guildId)
            throw new Error("Invitation not found.")
        if (invitation.status === "revoked") return
        const now = new Date().toISOString()
        if (invitation.localEventId) {
            const local = await ctx.db.get(invitation.localEventId)
            if (local) {
                const syncs = await ctx.db
                    .query("discordEventSyncs")
                    .withIndex("eventId", (q) => q.eq("eventId", local._id))
                    .collect()
                await queueEventDiscordDeletion(
                    ctx,
                    String(local._id),
                    eventDiscordDeletion(local, syncs)
                )
                for (const sync of syncs) await ctx.db.delete(sync._id)
                await ctx.db.patch(local._id, {
                    sharedAccessRevoked: true,
                    updatedAt: now,
                })
                const jobs = await ctx.db
                    .query("eventScheduleJobs")
                    .withIndex("eventId", (q) => q.eq("eventId", local._id))
                    .collect()
                for (const job of jobs) await ctx.db.delete(job._id)
            }
        }
        await ctx.db.patch(invitation._id, {
            status: "revoked",
            updatedAt: now,
        })
        if (invitation.localEventId) {
            const host = await ctx.db.get(invitation.hostEventId)
            if (host) await refreshSharedMatchPresentation(ctx, host, now)
        }
        const roster = await ctx.db
            .query("rosters")
            .withIndex("eventId", (q) =>
                q.eq("eventId", invitation.hostEventId)
            )
            .unique()
        if (roster)
            await ctx.db.patch(roster._id, {
                squads: roster.squads.map((squad) => ({
                    ...squad,
                    players: squad.players.map((slot) =>
                        slot.allocatedGuildId === invitation.guestGuildId
                            ? {
                                  ack: false,
                                  roleName: slot.roleName,
                                  roleIcon: slot.roleIcon,
                                  note: slot.note,
                              }
                            : slot
                    ),
                })),
                updatedAt: now,
            })
    },
})

/** Guests edit local delivery/eligibility only; shared facts never enter this validator. */
export const configureLocal = mutation({
    args: {
        registrationStart: v.optional(v.string()),
        localRosterMessageVariant: v.optional(
            v.union(v.literal("photo_text"), v.literal("photo"))
        ),
        localRosterMentionPlayers: v.optional(v.boolean()),
        ...scope,
        eventId: v.id("events"),
        announcementChannelId: v.optional(v.string()),
        eventInfoChannelId: v.optional(v.string()),
        eventResultsChannelId: v.optional(v.string()),
        meetingChannelId: v.optional(v.string()),
        squadVoiceCategoryId: v.optional(v.string()),
        pingMode: v.union(
            v.literal("none"),
            v.literal("clan"),
            v.literal("roles")
        ),
        pingRoleIds: v.array(v.string()),
        createForumChannel: v.boolean(),
        createSignupThread: v.boolean(),
        createSquadVoiceChannels: v.boolean(),
        createParticipantRoles: v.boolean(),
        allowNonMembersSignup: v.boolean(),
        useGeneralSignup: v.boolean(),
        requiredRoleIds: v.array(v.string()),
        signupGroupIds: v.array(v.string()),
        attendanceReminderHours: v.array(v.number()),
        signupReminderStatuses: v.array(
            v.union(
                v.literal("recruit"),
                v.literal("member"),
                v.literal("reserve_member")
            )
        ),
        rewardRoleIds: v.array(v.string()),
        allowedSignupStatuses: v.array(
            v.union(
                v.literal("recruit"),
                v.literal("member"),
                v.literal("reserve_member"),
                v.literal("mercenary")
            )
        ),
        signupGroupLimits: v.array(
            v.object({ groupId: v.string(), max: v.number() })
        ),
        createDebriefThread: v.optional(v.boolean()),
        deleteForumAfterConclusion: v.optional(v.boolean()),
        debriefDestination: v.optional(debriefDestinationValidator),
        debriefForumChannelId: v.optional(v.string()),
        topicPresetId: v.optional(v.id("topicPresets")),
    },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const fields: Record<string, unknown> = { ...args }
        for (const key of ["secret", "actor", "eventId", "guildId"])
            delete fields[key]
        return configureSharedMatchLocal(
            ctx,
            args.guildId,
            args.eventId,
            fields
        )
    },
})
