import { query } from "./_generated/server";
import { v } from "convex/values";

function normalizeDoc<T extends { _id: unknown }>(doc: T) {
  return {
    ...doc,
    id: String(doc._id),
  };
}

export const getServerContext = query({
  args: {
    userId: v.string(),
    serverId: v.string(),
  },
  handler: async (ctx, args) => {
    const [user, server] = await Promise.all([
      ctx.db.query("users").withIndex("id", (q) => q.eq("id", args.userId)).unique(),
      ctx.db.query("guilds").withIndex("id", (q) => q.eq("id", args.serverId)).unique(),
    ]);

    if (!user || !server) {
      return null;
    }

    const canAccess =
      user.guildId === server.id ||
      user.managedGuildIds.includes(server.id) ||
      user.mercenaryGuildIds.includes(server.id);

    if (!canAccess) {
      return null;
    }

    const canAdmin = server.adminIds.includes(user.id);
    const [events, topicPresets, squadPresets, rosters, groups, assignments] = await Promise.all([
      ctx.db.query("events").withIndex("guildId", (q) => q.eq("guildId", server.id)).collect(),
      ctx.db.query("topicPresets").withIndex("guildId", (q) => q.eq("guildId", server.id)).collect(),
      ctx.db.query("squadPresets").withIndex("guildId", (q) => q.eq("guildId", server.id)).collect(),
      ctx.db.query("rosters").collect(),
      ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", server.id)).collect(),
      ctx.db.query("userAssignments").withIndex("serverId", (q) => q.eq("serverId", server.id)).collect(),
    ]);

    const relevantRosters = rosters.filter((roster) => {
      const event = events.find((item) => item._id === roster.eventId);
      return Boolean(event);
    });

    return {
      user,
      server,
      canAdmin,
      events: events.map(normalizeDoc),
      topicPresets: topicPresets.map(normalizeDoc),
      squadPresets: squadPresets.map(normalizeDoc),
      rosters: relevantRosters.map(normalizeDoc),
      groups: groups.map(normalizeDoc),
      assignments: assignments.map(normalizeDoc),
    };
  },
});

export const getUsersByIds = query({
  args: {
    userIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const uniqueIds = [...new Set(args.userIds)];
    const users = await Promise.all(
      uniqueIds.map((userId) => ctx.db.query("users").withIndex("id", (q) => q.eq("id", userId)).unique()),
    );

    return users.filter(Boolean);
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const getAssignmentWithUser = query({
  args: {
    assignmentId: v.id("userAssignments"),
  },
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("id", (q) => q.eq("id", assignment.userId))
      .unique();

    return {
      ...assignment,
      id: String(assignment._id),
      userName: user?.name || "Unknown Player",
    };
  },
});

export const getRosterById = query({
  args: {
    rosterId: v.id("rosters"),
  },
  handler: async (ctx, args) => {
    const roster = await ctx.db.get(args.rosterId);
    return roster ? normalizeDoc(roster) : null;
  },
});

export const getSquadPresetById = query({
  args: {
    presetId: v.id("squadPresets"),
  },
  handler: async (ctx, args) => {
    const preset = await ctx.db.get(args.presetId);
    return preset ? normalizeDoc(preset) : null;
  },
});

export const getTopicPresetById = query({
  args: {
    presetId: v.id("topicPresets"),
  },
  handler: async (ctx, args) => {
    const preset = await ctx.db.get(args.presetId);
    return preset ? normalizeDoc(preset) : null;
  },
});
