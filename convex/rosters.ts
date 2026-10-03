import {
    UpdateRosterAttendanceUseCase,
    UpsertRosterUseCase,
} from "../src/application/rosters/roster-commands.use-case"
import { ConvexRosterCommandRepository } from "../src/infrastructure/convex/roster-command-repositories"
import { deriveEventStatus } from "../src/domain/events/status"
import { assertSessionGateway } from "./dashboardSessionStore"
import { authorizeRosterManager } from "./rosterWriterAccess"
import { resolveGameScope } from "../src/domain/games/game"
import { mutation } from "./integrationMutation"
import { query } from "./_generated/server"
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
    },
    handler: async (ctx, args) => {
        const { event, guildId } = await authorizeRosterManager(ctx, args)
        const existing = args.rosterId
            ? await ctx.db.get(args.rosterId)
            : await ctx.db
                  .query("rosters")
                  .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                  .unique()
        if (
            (args.rosterId && !existing) ||
            (existing &&
                (existing.eventId !== args.eventId ||
                    (existing.guildId !== undefined &&
                        existing.guildId !== guildId)))
        )
            throw new Error("Roster not found.")
        if (args.squadPresetId) {
            const preset = await ctx.db.get(args.squadPresetId)
            if (!preset || preset.guildId !== guildId)
                throw new Error("Squad preset not found.")
            if (
                resolveGameScope(event.gameId) !==
                resolveGameScope(preset.gameId)
            ) {
                throw new Error(
                    "Squad preset does not belong to this event's game."
                )
            }
        }
        const useCase = new UpsertRosterUseCase(
            new ConvexRosterCommandRepository(ctx)
        )
        return await useCase.execute({
            rosterId: args.rosterId ? String(args.rosterId) : undefined,
            eventId: String(args.eventId),
            squadPresetId: args.squadPresetId
                ? String(args.squadPresetId)
                : undefined,
            squads: args.squads,
            reservePlayerIds: args.reservePlayerIds,
            reserveAttendances: args.reserveAttendances ?? [],
            notAttendingPlayerIds: args.notAttendingPlayerIds,
            streamerId: args.streamerId,
            published: args.published,
        })
    },
})

export const getByEventId = query({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("rosters")
            .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
            .unique()
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
        if (
            !event ||
            event.guildId !== args.guildId ||
            deriveEventStatus(event) !== "starting" ||
            !roster?.published ||
            (roster.guildId !== undefined && roster.guildId !== args.guildId)
        )
            throw new Error("Attendance unavailable.")
        return await new UpdateRosterAttendanceUseCase(
            new ConvexRosterCommandRepository(ctx)
        ).acknowledge(String(args.eventId), args.userId)
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

        const roster = await ctx.db.get(args.rosterId)
        if (!roster) {
            throw new Error("Roster not found.")
        }
        if (roster.published) {
            throw new Error("Published rosters cannot be deleted.")
        }

        await ctx.db.delete(args.rosterId)
        return { ok: true as const }
    },
})
