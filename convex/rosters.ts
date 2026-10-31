import {
    DeclineRosterAttendanceUseCase,
    UpdateRosterAttendanceUseCase,
} from "../src/application/rosters/roster-commands.use-case"
import { ConvexRosterCommandRepository } from "../src/infrastructure/convex/roster-command-repositories"
import { ConvexEventWorkflowRepository } from "../src/infrastructure/convex/event-workflow-repositories"
import { AttendanceDeclineRejected } from "../src/domain/rosters/attendance-decline"
import { ManageRoster } from "../src/application/rosters/manage-roster"
import { deriveEventStatus } from "../src/domain/events/status"
import { assertSessionGateway } from "./dashboardSessionStore"
import { authorizeRosterManager } from "./rosterWriterAccess"
import { systemClock } from "../src/domain/shared/clock"
import { mutation } from "./integrationMutation"
import { v } from "convex/values"

const dashboardActor = v.object({
    sid: v.string(),
    subject: v.string(),
    userRecordId: v.string(),
    superadmin: v.boolean(),
})

const rosterPlayer = v.object({
    id: v.optional(v.string()),
    customName: v.optional(v.string()),
    ack: v.boolean(),
    confirmed: v.optional(v.boolean()),
    note: v.optional(v.string()),
    roleName: v.optional(v.string()),
    roleIcon: v.optional(v.string()),
})

const reserveAttendance = v.object({
    userId: v.string(),
    ack: v.boolean(),
    confirmed: v.optional(v.boolean()),
})

const attendanceStatus = v.union(
    v.literal("pending"),
    v.literal("acknowledged"),
    v.literal("confirmed")
)

const rosterSquad = v.object({
    name: v.string(),
    group: v.string(),
    order: v.number(),
    color: v.string(),
    icon: v.optional(v.string()),
    players: v.array(rosterPlayer),
})

export const upsert = mutation({
    args: {
        secret: v.string(),
        serverId: v.id("guilds"),
        actor: dashboardActor,
        rosterId: v.optional(v.id("rosters")),
        eventId: v.id("events"),
        squadPresetId: v.optional(v.id("squadPresets")),
        squads: v.array(rosterSquad),
        reservePlayerIds: v.array(v.string()),
        reserveAttendances: v.optional(v.array(reserveAttendance)),
        notAttendingPlayerIds: v.array(v.string()),
        streamerId: v.optional(v.string()),
        published: v.boolean(),
        // The dashboard's per-publish choice for the Discord roster message
        // (board D5). Not part of /api/v1: a live publish action.
        discordPublish: v.optional(
            v.object({
                variant: v.union(v.literal("photo_text"), v.literal("photo")),
                mentionPlayers: v.boolean(),
            })
        ),
    },
    handler: async (ctx, args) => {
        const { guildId } = await authorizeRosterManager(ctx, args)
        return new ManageRoster(
            new ConvexRosterCommandRepository(ctx),
            systemClock
        ).save({
            ...args,
            guildId,
            requestedBy: args.actor.subject,
            reserveAttendances: args.reserveAttendances ?? [],
        })
    },
})

export const acknowledgeAttendance = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        eventId: v.id("events"),
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const event = await ctx.db.get(args.eventId)
        const roster = await ctx.db
            .query("rosters")
            .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
            .unique()
        const gameStart = event ? Date.parse(event.gameStart) : Number.NaN
        if (
            !event ||
            event.guildId !== args.guildId ||
            deriveEventStatus(event) === "concluded" ||
            (Number.isFinite(gameStart) && Date.now() >= gameStart) ||
            !roster?.published ||
            (roster.guildId !== undefined && roster.guildId !== args.guildId)
        )
            throw new Error("Attendance unavailable.")
        return await new UpdateRosterAttendanceUseCase(
            new ConvexRosterCommandRepository(ctx)
        ).acknowledge(String(args.eventId), args.userId)
    },
})

/**
 * The bot's "Can't make it" button: a player on the published roster declines
 * before the game starts. Internal secret only; the guild comes from the
 * event's own Discord context and must match. Returns `changed: false` for a
 * repeated identical decline, and a rejection code instead of throwing for
 * expected refusals so the bot can answer the player in their language.
 */
export const declineAttendance = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        eventId: v.id("events"),
        userId: v.string(),
        reason: v.string(),
    },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const roster = await ctx.db
            .query("rosters")
            .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
            .unique()
        if (roster?.guildId !== undefined && roster.guildId !== args.guildId)
            throw new Error("Attendance unavailable.")
        try {
            const result = await new DeclineRosterAttendanceUseCase(
                new ConvexRosterCommandRepository(ctx),
                new ConvexEventWorkflowRepository(ctx),
                systemClock
            ).execute({
                guildId: args.guildId,
                eventId: String(args.eventId),
                userId: args.userId,
                reason: args.reason,
            })
            return { ...result, rejected: null }
        } catch (error) {
            if (error instanceof AttendanceDeclineRejected)
                return {
                    ok: false as const,
                    changed: false,
                    rejected: error.code,
                }
            throw error
        }
    },
})

export const setAttendanceStatus = mutation({
    args: {
        secret: v.string(),
        serverId: v.id("guilds"),
        actor: dashboardActor,
        eventId: v.id("events"),
        userId: v.string(),
        status: attendanceStatus,
    },
    handler: async (ctx, args) => {
        const { guildId } = await authorizeRosterManager(ctx, args)
        const roster = await ctx.db
            .query("rosters")
            .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
            .unique()
        if (
            !roster ||
            (roster.guildId !== undefined && roster.guildId !== guildId)
        )
            throw new Error("Roster not found.")
        return await new UpdateRosterAttendanceUseCase(
            new ConvexRosterCommandRepository(ctx)
        ).setStatus(String(args.eventId), args.userId, args.status)
    },
})

/** Deletes a draft roster only. Published rosters must be unpublished first. */
export const deleteDraft = mutation({
    args: {
        secret: v.string(),
        rosterId: v.id("rosters"),
    },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)

        await new ManageRoster(
            new ConvexRosterCommandRepository(ctx),
            systemClock
        ).deleteDraft(args.rosterId)
        return { ok: true as const }
    },
})
