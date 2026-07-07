import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

function assertInternalSecret(secret: string) {
  if (secret !== INTERNAL_AUTH_SECRET) {
    throw new Error("Unauthorized.");
  }
}

function normalizeAssignment<T extends { _id: unknown }>(assignment: T) {
  return {
    ...assignment,
    id: String(assignment._id),
    secondaryGroupIds: "secondaryGroupIds" in assignment && Array.isArray(assignment.secondaryGroupIds) ? assignment.secondaryGroupIds : [],
  };
}

export const listForServer = query({
  args: {
    serverId: v.string(),
  },
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("userAssignments")
      .withIndex("serverId", (q) => q.eq("serverId", args.serverId))
      .collect();

    return assignments.map(normalizeAssignment);
  },
});

export const getById = query({
  args: {
    assignmentId: v.id("userAssignments"),
  },
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get(args.assignmentId);
    return assignment ? normalizeAssignment(assignment) : null;
  },
});

export const upsert = mutation({
  args: {
    secret: v.string(),
    serverId: v.string(),
    assignmentId: v.optional(v.id("userAssignments")),
    userId: v.string(),
    type: v.union(v.literal("member"), v.literal("mercenary")),
    primaryGroupId: v.optional(v.id("groups")),
    secondaryGroupIds: v.array(v.id("groups")),
    paused: v.boolean(),
    pausedNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const [server, user] = await Promise.all([
      ctx.db.query("guilds").withIndex("id", (q) => q.eq("id", args.serverId)).unique(),
      ctx.db.query("users").withIndex("id", (q) => q.eq("id", args.userId)).unique(),
    ]);

    if (!server || !user) {
      throw new Error("Server or user not found.");
    }

    const groups = await ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", args.serverId)).collect();
    const validGroupIds = new Set(groups.map((group) => String(group._id)));
    if (args.primaryGroupId && !validGroupIds.has(String(args.primaryGroupId))) {
      throw new Error("Primary group does not belong to this server.");
    }

    if (args.secondaryGroupIds.some((groupId) => !validGroupIds.has(String(groupId)))) {
      throw new Error("One of the selected secondary groups does not belong to this server.");
    }

    const duplicate = await ctx.db
      .query("userAssignments")
      .withIndex("serverId_userId", (q) => q.eq("serverId", args.serverId).eq("userId", args.userId))
      .unique();

    if (duplicate && duplicate._id !== args.assignmentId) {
      throw new Error("This user is already assigned to this server.");
    }

    const now = new Date().toISOString();
    let assignmentId = args.assignmentId;

    if (assignmentId) {
      await ctx.db.patch(assignmentId, {
        type: args.type,
        primaryGroupId: args.primaryGroupId,
        secondaryGroupIds: args.secondaryGroupIds.filter((groupId) => groupId !== args.primaryGroupId),
        paused: args.paused,
        pausedNote: args.pausedNote,
        updatedAt: now,
      });
    } else {
      assignmentId = await ctx.db.insert("userAssignments", {
        userId: args.userId,
        serverId: args.serverId,
        type: args.type,
        primaryGroupId: args.primaryGroupId,
        secondaryGroupIds: args.secondaryGroupIds.filter((groupId) => groupId !== args.primaryGroupId),
        paused: args.paused,
        pausedNote: args.pausedNote,
        createdAt: now,
        updatedAt: now,
      });
    }

    const currentServerAssignments = await ctx.db
      .query("userAssignments")
      .withIndex("serverId", (q) => q.eq("serverId", args.serverId))
      .collect();

    const memberAssignments = currentServerAssignments.filter((item) => item.type === "member");
    const mercAssignments = currentServerAssignments.filter((item) => item.type === "mercenary");
    const groupNameById = new Map(groups.map((group) => [String(group._id), group.name]));

    await ctx.db.patch(server._id, {
      memberIds: memberAssignments.map((item) => item.userId),
      members: memberAssignments.map((item) => ({
        id: item.userId,
        primaryGroup: item.primaryGroupId ? groupNameById.get(String(item.primaryGroupId)) : undefined,
        secondaryGroups: (item.secondaryGroupIds ?? [])
          .map((groupId) => groupNameById.get(String(groupId)))
          .filter((groupName): groupName is string => Boolean(groupName)),
        joinedAt: item.createdAt,
      })),
      mercenaryIds: mercAssignments.map((item) => item.userId),
      updatedAt: now,
    });

    const allAssignmentsForUser = await ctx.db
      .query("userAssignments")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();

    const primaryAssignment = allAssignmentsForUser.find((item) => item.type === "member");
    const mercenaryGuildIds = allAssignmentsForUser
      .filter((item) => item.type === "mercenary")
      .map((item) => item.serverId);

    await ctx.db.patch(user._id, {
      guildId: primaryAssignment?.serverId,
      mercenaryGuildIds,
      updatedAt: now,
    });

    return String(assignmentId);
  },
});

export const remove = mutation({
  args: {
    secret: v.string(),
    assignmentId: v.id("userAssignments"),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found.");
    }

    await ctx.db.delete(args.assignmentId);
    const now = new Date().toISOString();

    const [server, user] = await Promise.all([
      ctx.db.query("guilds").withIndex("id", (q) => q.eq("id", assignment.serverId)).unique(),
      ctx.db.query("users").withIndex("id", (q) => q.eq("id", assignment.userId)).unique(),
    ]);

    if (server) {
      const currentServerAssignments = await ctx.db
        .query("userAssignments")
        .withIndex("serverId", (q) => q.eq("serverId", assignment.serverId))
        .collect();
      const memberAssignments = currentServerAssignments.filter((item) => item.type === "member");
      const mercAssignments = currentServerAssignments.filter((item) => item.type === "mercenary");
      const groups = await ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", assignment.serverId)).collect();
      const groupNameById = new Map(groups.map((group) => [String(group._id), group.name]));
      await ctx.db.patch(server._id, {
        memberIds: memberAssignments.map((item) => item.userId),
        members: memberAssignments.map((item) => ({
          id: item.userId,
          primaryGroup: item.primaryGroupId ? groupNameById.get(String(item.primaryGroupId)) : undefined,
          secondaryGroups: (item.secondaryGroupIds ?? [])
            .map((groupId) => groupNameById.get(String(groupId)))
            .filter((groupName): groupName is string => Boolean(groupName)),
          joinedAt: item.createdAt,
        })),
        mercenaryIds: mercAssignments.map((item) => item.userId),
        updatedAt: now,
      });
    }

    if (user) {
      const allAssignmentsForUser = await ctx.db
        .query("userAssignments")
        .withIndex("userId", (q) => q.eq("userId", assignment.userId))
        .collect();
      const primaryAssignment = allAssignmentsForUser.find((item) => item.type === "member");
      const mercenaryGuildIds = allAssignmentsForUser
        .filter((item) => item.type === "mercenary")
        .map((item) => item.serverId);
      await ctx.db.patch(user._id, {
        guildId: primaryAssignment?.serverId,
        mercenaryGuildIds,
        updatedAt: now,
      });
    }
  },
});
