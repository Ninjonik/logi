import { query } from "./_generated/server";
import { v } from "convex/values";

function normalizeDoc<T extends { _id: unknown }>(doc: T) {
  return {
    ...doc,
    id: String(doc._id),
  };
}

function deriveEventStatus(event: {
  registrationEnd: string;
  meetingStart: string;
  gameEnd: string;
  status?: string;
}) {
  if (event.status === "concluded") {
    return "concluded" as const;
  }

  const now = Date.now();
  const registrationEnd = new Date(event.registrationEnd).getTime();
  const startingAt = new Date(event.meetingStart).getTime() - 24 * 60 * 60 * 1000;
  const gameEnd = new Date(event.gameEnd).getTime();

  if (Number.isFinite(gameEnd) && now >= gameEnd) return "concluded" as const;
  if (Number.isFinite(startingAt) && now >= startingAt) return "starting" as const;
  if (Number.isFinite(registrationEnd) && now >= registrationEnd) return "closed" as const;
  return "registration" as const;
}

function normalizeEventDoc<
  T extends {
    _id: unknown;
    registrationEnd: string;
    meetingStart: string;
    gameEnd: string;
    status?: "registration" | "closed" | "starting" | "concluded";
    statusUpdatedAt?: string;
    concludedAt?: string;
    attendanceReminderLog?: Array<{ userId: string; offsetHours: number; sentAt: string }>;
    updatedAt?: string;
    createdAt?: string;
  },
>(event: T) {
  return {
    ...normalizeDoc(event),
    status: event.status ?? deriveEventStatus(event),
    statusUpdatedAt: event.statusUpdatedAt ?? event.updatedAt ?? event.createdAt ?? new Date().toISOString(),
    concludedAt: event.concludedAt,
    attendanceReminderLog: event.attendanceReminderLog ?? [],
  };
}

function normalizeAssignmentDoc<
  T extends {
    _id: unknown;
    serverId: string;
    primaryGroupId?: unknown;
    secondaryGroupIds?: unknown[];
  },
>(assignment: T, groupNameById: Map<string, string>) {
  const primaryGroupId = assignment.primaryGroupId ? String(assignment.primaryGroupId) : undefined;
  const secondaryGroupIds = Array.isArray(assignment.secondaryGroupIds)
    ? assignment.secondaryGroupIds.map((groupId) => String(groupId))
    : [];

  return {
    ...assignment,
    id: String(assignment._id),
    primaryGroupId,
    secondaryGroupIds,
    primaryGroup: primaryGroupId ? groupNameById.get(primaryGroupId) : undefined,
    secondaryGroups: secondaryGroupIds
      .map((groupId) => groupNameById.get(groupId))
      .filter((groupName): groupName is string => Boolean(groupName)),
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

    const discordAccess = await ctx.db
      .query("discordMemberAccess")
      .withIndex("guildId_userId", (q) => q.eq("guildId", args.serverId).eq("userId", args.userId))
      .unique();

    const canAccess =
      user.guildId === server.id ||
      user.managedGuildIds.includes(server.id) ||
      user.mercenaryGuildIds.includes(server.id) ||
      Boolean(discordAccess?.hasDashboardAccess);

    if (!canAccess) {
      return null;
    }

    const canAdmin = server.adminIds.includes(user.id) || Boolean(discordAccess?.isAdmin);
    const [events, topicPresets, squadPresets, groups, assignments, discordConfig] = await Promise.all([
      ctx.db.query("events").withIndex("guildId", (q) => q.eq("guildId", server.id)).collect(),
      ctx.db.query("topicPresets").withIndex("guildId", (q) => q.eq("guildId", server.id)).collect(),
      ctx.db.query("squadPresets").withIndex("guildId", (q) => q.eq("guildId", server.id)).collect(),
      ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", server.id)).collect(),
      ctx.db.query("userAssignments").withIndex("serverId", (q) => q.eq("serverId", server.id)).collect(),
      ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", server.id)).unique(),
    ]);

    const eventRosters = await Promise.all(
      events.map((event) =>
        ctx.db.query("rosters").withIndex("eventId", (q) => q.eq("eventId", event._id)).unique(),
      ),
    );
    const relevantRosters = eventRosters.filter((roster): roster is NonNullable<typeof roster> => Boolean(roster));

    const groupNameById = new Map(groups.map((group) => [String(group._id), group.name]));

    return {
      user,
      server,
      canAdmin,
      events: events.map(normalizeEventDoc),
      topicPresets: topicPresets.map(normalizeDoc),
      squadPresets: squadPresets.map(normalizeDoc),
      rosters: relevantRosters.map(normalizeDoc),
      groups: groups.map(normalizeDoc),
      assignments: assignments.map((assignment) => normalizeAssignmentDoc(assignment, groupNameById)),
      discordConfig: discordConfig ? normalizeDoc(discordConfig) : null,
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

    const [user, groups] = await Promise.all([
      ctx.db.query("users").withIndex("id", (q) => q.eq("id", assignment.userId)).unique(),
      ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", assignment.serverId)).collect(),
    ]);

    const groupNameById = new Map(groups.map((group) => [String(group._id), group.name]));
    const normalizedAssignment = normalizeAssignmentDoc(assignment, groupNameById);

    return {
      ...normalizedAssignment,
      user,
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
