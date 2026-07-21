import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

const attendanceStatus = v.union(
  v.literal("pending"),
  v.literal("acknowledged"),
  v.literal("confirmed"),
);

function getAttendanceFields(status: "pending" | "acknowledged" | "confirmed") {
  if (status === "confirmed") {
    return { ack: true, confirmed: true };
  }

  if (status === "acknowledged") {
    return { ack: true, confirmed: false };
  }

  return { ack: false, confirmed: false };
}

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
    const { rosterId, ...data } = args;
    const now = new Date().toISOString();

    if (rosterId) {
      await ctx.db.patch(rosterId, {
        ...data,
        reserveAttendances: data.reserveAttendances ?? [],
        updatedAt: now,
      });
      return rosterId;
    }

    const existingForEvent = await ctx.db
      .query("rosters")
      .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
      .unique();

    if (existingForEvent) {
      await ctx.db.patch(existingForEvent._id, {
        ...data,
        reserveAttendances: data.reserveAttendances ?? [],
        updatedAt: now,
      });
      return existingForEvent._id;
    }

    return await ctx.db.insert("rosters", {
      ...data,
      reserveAttendances: data.reserveAttendances ?? [],
      createdAt: now,
      updatedAt: now,
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
    const roster = await ctx.db
      .query("rosters")
      .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
      .unique();

    if (!roster) {
      throw new Error("Roster not found.");
    }

    let found = false;
    const squads = roster.squads.map((squad) => ({
      ...squad,
      players: squad.players.map((player) => {
        if (player.id !== args.userId) {
          return player;
        }

        found = true;
        return { ...player, ack: true, confirmed: false };
      }),
    }));

    if (!found) {
      throw new Error("User is not on the roster.");
    }

    await ctx.db.patch(roster._id, {
      squads,
      updatedAt: new Date().toISOString(),
    });

    return { ok: true };
  },
});

export const setAttendanceStatus = mutation({
  args: {
    eventId: v.id("events"),
    userId: v.string(),
    status: attendanceStatus,
  },
  handler: async (ctx, args) => {
    const roster = await ctx.db
      .query("rosters")
      .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
      .unique();

    if (!roster) {
      throw new Error("Roster not found.");
    }

    let found = false;
    const nextAttendance = getAttendanceFields(args.status);
    const squads = roster.squads.map((squad) => ({
      ...squad,
      players: squad.players.map((player) => {
        if (player.id !== args.userId) {
          return player;
        }

        found = true;
        return {
          ...player,
          ...nextAttendance,
        };
      }),
    }));
    const reserveAttendances = (roster.reserveAttendances ?? []).map((entry) => {
      if (entry.userId !== args.userId) {
        return entry;
      }

      found = true;
      return {
        ...entry,
        ...nextAttendance,
      };
    });

    if (!found && roster.reservePlayerIds.includes(args.userId)) {
      found = true;
      reserveAttendances.push({
        userId: args.userId,
        ...nextAttendance,
      });
    }

    if (!found) {
      throw new Error("User is not on the roster.");
    }

    await ctx.db.patch(roster._id, {
      squads,
      reserveAttendances,
      updatedAt: new Date().toISOString(),
    });

    return { ok: true };
  },
});
