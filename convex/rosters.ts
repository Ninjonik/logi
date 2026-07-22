import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { UpdateRosterAttendanceUseCase, UpsertRosterUseCase } from "../src/application/rosters/roster-commands.use-case";
import { ConvexRosterCommandRepository } from "../src/infrastructure/convex/roster-command-repositories";

const rosterPlayer = v.object({
  id: v.optional(v.string()),
  customName: v.optional(v.string()),
  ack: v.boolean(),
  confirmed: v.optional(v.boolean()),
  note: v.optional(v.string()),
  roleName: v.optional(v.string()),
  roleIcon: v.optional(v.string()),
});

const reserveAttendance = v.object({
  userId: v.string(),
  ack: v.boolean(),
  confirmed: v.optional(v.boolean()),
});

const attendanceStatus = v.union(v.literal("pending"), v.literal("acknowledged"), v.literal("confirmed"));

const rosterSquad = v.object({
  name: v.string(),
  group: v.string(),
  order: v.number(),
  color: v.string(),
  icon: v.optional(v.string()),
  players: v.array(rosterPlayer),
});

export const upsert = mutation({
  args: {
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
    const useCase = new UpsertRosterUseCase(new ConvexRosterCommandRepository(ctx));
    return await useCase.execute({
      rosterId: args.rosterId ? String(args.rosterId) : undefined,
      eventId: String(args.eventId),
      squadPresetId: args.squadPresetId ? String(args.squadPresetId) : undefined,
      squads: args.squads,
      reservePlayerIds: args.reservePlayerIds,
      reserveAttendances: args.reserveAttendances ?? [],
      notAttendingPlayerIds: args.notAttendingPlayerIds,
      streamerId: args.streamerId,
      published: args.published,
    });
  },
});

export const getByEventId = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rosters")
      .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
      .unique();
  },
});

export const acknowledgeAttendance = mutation({
  args: {
    eventId: v.id("events"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await new UpdateRosterAttendanceUseCase(new ConvexRosterCommandRepository(ctx))
      .acknowledge(String(args.eventId), args.userId);
  },
});

export const setAttendanceStatus = mutation({
  args: {
    eventId: v.id("events"),
    userId: v.string(),
    status: attendanceStatus,
  },
  handler: async (ctx, args) => {
    return await new UpdateRosterAttendanceUseCase(new ConvexRosterCommandRepository(ctx))
      .setStatus(String(args.eventId), args.userId, args.status);
  },
});
