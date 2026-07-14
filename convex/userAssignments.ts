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

export const importDiscordMembers = mutation({
  args: {
    secret: v.string(),
    serverId: v.string(),
    assignmentType: v.union(v.literal("member"), v.literal("mercenary")),
    members: v.array(v.object({
      userId: v.string(),
      name: v.string(),
      avatar: v.string(),
      secondaryGroupIds: v.array(v.id("groups")),
    })),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const server = await ctx.db
      .query("guilds")
      .withIndex("id", (q) => q.eq("id", args.serverId))
      .unique();

    if (!server) {
      throw new Error("Server not found.");
    }

    const now = new Date().toISOString();
    const groups = await ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", args.serverId)).collect();
    const validGroupIds = new Set(groups.map((group) => String(group._id)));
    const groupNameById = new Map(groups.map((group) => [String(group._id), group.name]));
    const existingAssignments = await ctx.db
      .query("userAssignments")
      .withIndex("serverId", (q) => q.eq("serverId", args.serverId))
      .collect();
    const existingAssignmentsByUserId = new Map(existingAssignments.map((assignment) => [assignment.userId, assignment]));

    let createdUsers = 0;
    let updatedUsers = 0;
    let createdAssignments = 0;
    let updatedAssignments = 0;

    for (const member of args.members) {
      if (member.secondaryGroupIds.some((groupId) => !validGroupIds.has(String(groupId)))) {
        throw new Error("One of the selected secondary groups does not belong to this server.");
      }

      const existingUser = await ctx.db
        .query("users")
        .withIndex("id", (q) => q.eq("id", member.userId))
        .unique();

      if (existingUser) {
        await ctx.db.patch(existingUser._id, {
          name: member.name,
          avatar: member.avatar || existingUser.avatar || "https://cdn.discordapp.com/embed/avatars/0.png",
          updatedAt: now,
        });
        updatedUsers += 1;
      } else {
        await ctx.db.insert("users", {
          id: member.userId,
          name: member.name,
          avatar: member.avatar || "https://cdn.discordapp.com/embed/avatars/0.png",
          managedGuildIds: [],
          guildId: undefined,
          mercenaryGuildIds: [],
          isStreamer: false,
          score: 0,
          performance: undefined,
          createdAt: now,
          updatedAt: now,
        });
        createdUsers += 1;
      }

      const existingAssignment = existingAssignmentsByUserId.get(member.userId);
      const primaryGroupId = existingAssignment?.primaryGroupId;
      const mergedSecondaryGroupIds = [...new Set([
        ...(existingAssignment?.secondaryGroupIds ?? []).map((groupId) => String(groupId)),
        ...member.secondaryGroupIds.map((groupId) => String(groupId)),
      ])]
        .filter((groupId) => groupId !== String(primaryGroupId ?? ""))
        .map((groupId) => groupId as any);

      if (existingAssignment) {
        await ctx.db.patch(existingAssignment._id, {
          type: existingAssignment.type ?? args.assignmentType,
          primaryGroupId,
          secondaryGroupIds: mergedSecondaryGroupIds,
          paused: existingAssignment.paused,
          pausedNote: existingAssignment.pausedNote,
          updatedAt: now,
        });
        updatedAssignments += 1;
      } else {
        const insertedAssignmentId = await ctx.db.insert("userAssignments", {
          userId: member.userId,
          serverId: args.serverId,
          type: args.assignmentType,
          primaryGroupId: undefined,
          secondaryGroupIds: mergedSecondaryGroupIds,
          paused: false,
          pausedNote: undefined,
          createdAt: now,
          updatedAt: now,
        });
        const insertedAssignment = await ctx.db.get(insertedAssignmentId);
        if (insertedAssignment) {
          existingAssignmentsByUserId.set(member.userId, insertedAssignment);
        }
        createdAssignments += 1;
      }
    }

    const currentServerAssignments = await ctx.db
      .query("userAssignments")
      .withIndex("serverId", (q) => q.eq("serverId", args.serverId))
      .collect();

    const memberAssignments = currentServerAssignments.filter((item) => item.type === "member");
    const mercAssignments = currentServerAssignments.filter((item) => item.type === "mercenary");

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

    const touchedUserIds = [...new Set(args.members.map((member) => member.userId))];
    for (const userId of touchedUserIds) {
      const [user, allAssignmentsForUser] = await Promise.all([
        ctx.db.query("users").withIndex("id", (q) => q.eq("id", userId)).unique(),
        ctx.db.query("userAssignments").withIndex("userId", (q) => q.eq("userId", userId)).collect(),
      ]);

      if (!user) {
        continue;
      }

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

    return {
      importedCount: args.members.length,
      createdUsers,
      updatedUsers,
      createdAssignments,
      updatedAssignments,
    };
  },
});
