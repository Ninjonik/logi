import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const rosterPlayer = v.object({
  id: v.optional(v.string()),
  ack: v.boolean(),
  note: v.optional(v.string()),
  roleName: v.optional(v.string()),
});

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
        updatedAt: now,
      });
      return rosterId;
    } else {
      return await ctx.db.insert("rosters", {
        ...data,
        createdAt: now,
        updatedAt: now,
      });
    }
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
