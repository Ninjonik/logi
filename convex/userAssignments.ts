import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { getGuildByDiscordId, getGuildById, getGuildDiscordId, getUserByDiscordId } from "./identity";
import { syncRosterMembershipForEvent } from "./rosterSync";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

type AssignmentType = "member" | "mercenary";
type AssignmentStatus = "pending" | "recruit" | "active";

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

function getResolvedMemberStatus(type: AssignmentType, status: AssignmentStatus) {
  if (status === "pending") return "pending";
  if (status === "recruit") return "recruit";
  return type === "mercenary" ? "mercenary" : "member";
}

async function rebuildServerMembershipState(ctx: MutationCtx, serverDiscordId: string) {
  const [server, groups, currentServerAssignments] = await Promise.all([
    getGuildByDiscordId(ctx, serverDiscordId),
    ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", serverDiscordId)).collect(),
    ctx.db.query("userAssignments").withIndex("serverId", (q) => q.eq("serverId", serverDiscordId)).collect(),
  ]);

  if (!server) {
    return;
  }

  const activeMemberAssignments = currentServerAssignments.filter((item) => item.type === "member" && item.status !== "pending");
  const activeMercAssignments = currentServerAssignments.filter((item) => item.type === "mercenary" && item.status === "active");
  const groupNameById = new Map(groups.map((group) => [String(group._id), group.name]));

  await ctx.db.patch(server._id, {
    memberIds: activeMemberAssignments.map((item) => item.userId),
    members: activeMemberAssignments.map((item) => ({
      id: item.userId,
      primaryGroup: item.primaryGroupId ? groupNameById.get(String(item.primaryGroupId)) : undefined,
      secondaryGroups: (item.secondaryGroupIds ?? [])
        .map((groupId) => groupNameById.get(String(groupId)))
        .filter((groupName): groupName is string => Boolean(groupName)),
      joinedAt: item.createdAt,
      status: getResolvedMemberStatus(item.type, item.status),
    })),
    mercenaryIds: activeMercAssignments.map((item) => item.userId),
    updatedAt: new Date().toISOString(),
  });
}

async function rebuildUserMembershipState(ctx: MutationCtx, userId: string) {
  const [user, allAssignmentsForUser] = await Promise.all([
    getUserByDiscordId(ctx, userId),
    ctx.db.query("userAssignments").withIndex("userId", (q) => q.eq("userId", userId)).collect(),
  ]);

  if (!user) {
    return;
  }

  const primaryAssignment = allAssignmentsForUser.find((item) => item.type === "member" && item.status !== "pending");
  const mercenaryGuildIds = allAssignmentsForUser
    .filter((item) => item.type === "mercenary" && item.status === "active")
    .map((item) => item.serverId);

  await ctx.db.patch(user._id, {
    guildId: primaryAssignment?.serverId,
    mercenaryGuildIds,
    updatedAt: new Date().toISOString(),
  });
}

async function rebuildMembershipState(
  ctx: MutationCtx,
  serverDiscordId: string,
  userIds: string[],
) {
  await rebuildServerMembershipState(ctx, serverDiscordId);
  for (const userId of userIds) {
    await rebuildUserMembershipState(ctx, userId);
  }
}

async function syncOpenRostersForServer(ctx: MutationCtx, serverDiscordId: string) {
  const events = await ctx.db
    .query("events")
    .withIndex("guildId", (q) => q.eq("guildId", serverDiscordId))
    .collect();

  for (const event of events) {
    const registrationEndAt = new Date(event.registrationEnd).getTime();
    if ((event.kind ?? "match") !== "match" || (Number.isFinite(registrationEndAt) && Date.now() >= registrationEndAt)) {
      continue;
    }

    await syncRosterMembershipForEvent(ctx, event._id);
  }
}

async function saveAssignmentWithServerDiscordId(
  ctx: MutationCtx,
  args: {
    userId: string;
    serverDiscordId: string;
    assignmentId?: any;
    type: AssignmentType;
    status: AssignmentStatus;
    membershipCategoryId?: string;
    primaryGroupId?: any;
    secondaryGroupIds: any[];
    paused: boolean;
    pausedNote?: string;
  },
) {
  const [server, user] = await Promise.all([
    getGuildByDiscordId(ctx, args.serverDiscordId),
    getUserByDiscordId(ctx, args.userId),
  ]);

  if (!server || !user) {
    throw new Error("Server or user not found.");
  }

  const groups = await ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", args.serverDiscordId)).collect();
  const validGroupIds = new Set(groups.map((group) => String(group._id)));

  if (args.primaryGroupId && !validGroupIds.has(String(args.primaryGroupId))) {
    throw new Error("Primary group does not belong to this server.");
  }

  if (args.secondaryGroupIds.some((groupId) => !validGroupIds.has(String(groupId)))) {
    throw new Error("One of the selected secondary groups does not belong to this server.");
  }

  const duplicate = await ctx.db
    .query("userAssignments")
    .withIndex("serverId_userId", (q) => q.eq("serverId", args.serverDiscordId).eq("userId", args.userId))
    .unique();

  if (duplicate && duplicate._id !== args.assignmentId) {
    throw new Error("This user is already assigned to this server.");
  }

  const now = new Date().toISOString();
  const payload = {
    type: args.type,
    status: args.status,
    membershipCategoryId: args.membershipCategoryId,
    primaryGroupId: args.primaryGroupId,
    secondaryGroupIds: args.secondaryGroupIds.filter((groupId) => groupId !== args.primaryGroupId),
    paused: args.paused,
    pausedNote: args.pausedNote,
    updatedAt: now,
  };

  let assignmentId = args.assignmentId;
  if (assignmentId) {
    await ctx.db.patch(assignmentId, payload);
  } else {
    assignmentId = await ctx.db.insert("userAssignments", {
      userId: args.userId,
      serverId: args.serverDiscordId,
      ...payload,
      createdAt: now,
    });
  }

  await rebuildMembershipState(ctx, args.serverDiscordId, [args.userId]);
  await syncOpenRostersForServer(ctx, args.serverDiscordId);
  return String(assignmentId);
}

export const listForServer = query({
  args: {
    serverId: v.id("guilds"),
  },
  handler: async (ctx, args) => {
    const server = await getGuildById(ctx, args.serverId);
    if (!server) {
      return [];
    }

    const assignments = await ctx.db
      .query("userAssignments")
      .withIndex("serverId", (q) => q.eq("serverId", getGuildDiscordId(server)))
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

export const getForServerUser = query({
  args: {
    serverDiscordId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const assignment = await ctx.db
      .query("userAssignments")
      .withIndex("serverId_userId", (q) => q.eq("serverId", args.serverDiscordId).eq("userId", args.userId))
      .unique();

    return assignment ? normalizeAssignment(assignment) : null;
  },
});

export const upsert = mutation({
  args: {
    secret: v.string(),
    serverId: v.id("guilds"),
    assignmentId: v.optional(v.id("userAssignments")),
    userId: v.string(),
    type: v.union(v.literal("member"), v.literal("mercenary")),
    status: v.union(v.literal("pending"), v.literal("recruit"), v.literal("active")),
    membershipCategoryId: v.optional(v.string()),
    primaryGroupId: v.optional(v.id("groups")),
    secondaryGroupIds: v.array(v.id("groups")),
    paused: v.boolean(),
    pausedNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const server = await getGuildById(ctx, args.serverId);
    const serverDiscordId = server ? getGuildDiscordId(server) : undefined;
    if (!serverDiscordId) {
      throw new Error("Server Discord ID not found.");
    }
    return await saveAssignmentWithServerDiscordId(ctx, {
      userId: args.userId,
      serverDiscordId,
      assignmentId: args.assignmentId,
      type: args.type,
      status: args.status,
      membershipCategoryId: args.membershipCategoryId,
      primaryGroupId: args.primaryGroupId,
      secondaryGroupIds: args.secondaryGroupIds,
      paused: args.paused,
      pausedNote: args.pausedNote,
    });
  },
});

export const upsertByServerDiscordId = mutation({
  args: {
    secret: v.string(),
    serverDiscordId: v.string(),
    assignmentId: v.optional(v.id("userAssignments")),
    userId: v.string(),
    type: v.union(v.literal("member"), v.literal("mercenary")),
    status: v.union(v.literal("pending"), v.literal("recruit"), v.literal("active")),
    membershipCategoryId: v.optional(v.string()),
    primaryGroupId: v.optional(v.id("groups")),
    secondaryGroupIds: v.array(v.id("groups")),
    paused: v.boolean(),
    pausedNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    return await saveAssignmentWithServerDiscordId(ctx, args);
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
    await rebuildMembershipState(ctx, assignment.serverId, [assignment.userId]);
    await syncOpenRostersForServer(ctx, assignment.serverId);
  },
});

export const importDiscordMembers = mutation({
  args: {
    secret: v.string(),
    serverId: v.id("guilds"),
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

    const server = await getGuildById(ctx, args.serverId);
    if (!server) {
      throw new Error("Server not found.");
    }

    const serverDiscordId = getGuildDiscordId(server);
    const now = new Date().toISOString();
    const groups = await ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", serverDiscordId)).collect();
    const validGroupIds = new Set(groups.map((group) => String(group._id)));
    const existingAssignments = await ctx.db
      .query("userAssignments")
      .withIndex("serverId", (q) => q.eq("serverId", serverDiscordId))
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

      const existingUser = await getUserByDiscordId(ctx, member.userId);

      if (existingUser) {
        await ctx.db.patch(existingUser._id, {
          name: member.name,
          avatar: member.avatar || existingUser.avatar || "https://cdn.discordapp.com/embed/avatars/0.png",
          updatedAt: now,
        });
        updatedUsers += 1;
      } else {
        await ctx.db.insert("users", {
          discordId: member.userId,
          id: member.userId,
          name: member.name,
          avatar: member.avatar || "https://cdn.discordapp.com/embed/avatars/0.png",
          managedGuildIds: [],
          guildId: undefined,
          mercenaryGuildIds: [],
          isStreamer: false,
          score: 0,
          scores: {},
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
        .map((groupId) => groupId as never);

      if (existingAssignment) {
        await ctx.db.patch(existingAssignment._id, {
          type: existingAssignment.type ?? args.assignmentType,
          status: existingAssignment.status ?? "active",
          membershipCategoryId: existingAssignment.membershipCategoryId,
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
          serverId: serverDiscordId,
          type: args.assignmentType,
          status: "active",
          membershipCategoryId: undefined,
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

    const touchedUserIds = [...new Set(args.members.map((member) => member.userId))];
    await rebuildMembershipState(ctx, serverDiscordId, touchedUserIds);
    await syncOpenRostersForServer(ctx, serverDiscordId);

    return {
      importedCount: args.members.length,
      createdUsers,
      updatedUsers,
      createdAssignments,
      updatedAssignments,
    };
  },
});
