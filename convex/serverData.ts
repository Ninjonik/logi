import { query } from "./_generated/server";
import { v } from "convex/values";
import { getGuildDiscordId, getUserByDiscordId, getUserDiscordId } from "./identity";

function normalizeDoc<T extends { _id: unknown }>(doc: T) {
  return {
    ...doc,
    id: String(doc._id),
  };
}

function normalizeUserDoc<
  T extends {
    _id: unknown;
    discordId?: string;
    id?: string;
    platformIds?: string[];
    score?: number;
    scores?: Record<string, number>;
  },
>(user: T) {
  const legacyUser = user as T & { steamId?: string; platformId?: string };

  return {
    ...user,
    id: String(user._id),
    discordId: getUserDiscordId(user),
    platformIds: [...new Set(
      (user.platformIds ?? [legacyUser.platformId ?? legacyUser.steamId].filter(Boolean))
        .flatMap((entry) => String(entry).split(","))
        .map((entry) => entry.replace(/\s+/g, "").trim())
        .filter(Boolean),
    )],
    scores: user.scores ?? {},
  };
}

function normalizeGuildDoc<T extends { _id: unknown }>(guild: T) {
  return {
    ...normalizeDoc(guild),
    discordId: getGuildDiscordId(guild),
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
  const meetingCountdownStart = new Date(event.meetingStart).getTime() - 24 * 60 * 60 * 1000;
  const startingAt = Number.isFinite(registrationEnd)
    ? Math.max(registrationEnd, meetingCountdownStart)
    : meetingCountdownStart;
  const gameEnd = new Date(event.gameEnd).getTime();

  if (Number.isFinite(gameEnd) && now >= gameEnd) return "concluded" as const;
  if (Number.isFinite(startingAt) && now >= startingAt) return "starting" as const;
  if (Number.isFinite(registrationEnd) && now >= registrationEnd) return "closed" as const;
  return "registration" as const;
}

function resolveCreateForumChannel(event: {
  kind?: "match" | "training";
  createForumChannel?: boolean;
}) {
  if (typeof event.createForumChannel === "boolean") {
    return event.createForumChannel;
  }

  return (event.kind ?? "match") === "match";
}

function normalizeEventDoc<
  T extends {
    _id: unknown;
    registrationEnd: string;
    meetingStart: string;
    gameEnd: string;
    kind?: "match" | "training";
    thumbnailUrl?: string;
    meetingChannelId?: string;
    requiredRoleIds?: string[];
    rewardRoleIds?: string[];
    createForumChannel?: boolean;
    status?: "registration" | "closed" | "starting" | "concluded";
    statusUpdatedAt?: string;
    concludedAt?: string;
    eventResult?: {
      sourceUrl: string;
      mapId: string;
      mapName?: string;
      endedAt?: string;
      importedAt: string;
      sideA: string;
      sideB: string;
      outcome: "victory" | "defeat" | "draw";
      score: {
        sideA: number;
        sideB: number;
      };
    };
    matchStatsId?: unknown;
    attendanceReminderLog?: Array<{ userId: string; offsetHours: number; sentAt: string }>;
    participants?: Array<{ userId: string; status: "attending" | "not_attending"; group?: string | null; completed?: "passed" | "failed"; updatedAt: string }>;
    signUps?: Array<{ userId: string; group?: string | null }>;
    scoreAppliedAt?: string;
    scoreResolution?: "applied" | "skipped";
    absenceNotices?: Array<{ userId: string; reason: string; createdAt: string }>;
    updatedAt?: string;
    createdAt?: string;
  },
>(event: T) {
  const participants = event.participants ?? (event.signUps ?? []).map((signUp) => ({
    userId: signUp.userId,
    status: signUp.group && signUp.group !== "NOT_ATTENDING" ? "attending" as const : "not_attending" as const,
    group: signUp.group,
    updatedAt: event.updatedAt ?? event.createdAt ?? new Date().toISOString(),
  }));

  return {
    ...normalizeDoc(event),
    kind: event.kind ?? "match",
    thumbnailUrl: event.thumbnailUrl,
    meetingChannelId: event.meetingChannelId,
    requiredRoleIds: event.requiredRoleIds ?? [],
    rewardRoleIds: event.rewardRoleIds ?? [],
    createForumChannel: resolveCreateForumChannel(event),
    status: event.status ?? deriveEventStatus(event),
    statusUpdatedAt: event.statusUpdatedAt ?? event.updatedAt ?? event.createdAt ?? new Date().toISOString(),
    concludedAt: event.concludedAt,
    eventResult: event.eventResult,
    matchStatsId: event.matchStatsId ? String(event.matchStatsId) : undefined,
    matchId: event.matchStatsId ? String(event.matchStatsId) : undefined,
    attendanceReminderLog: event.attendanceReminderLog ?? [],
    scoreAppliedAt: event.scoreAppliedAt,
    scoreResolution: event.scoreResolution,
    absenceNotices: event.absenceNotices ?? [],
    participants,
    signUps: participants.map((participant) => ({
      userId: participant.userId,
      group: participant.status === "attending" ? (participant.group ?? "ATTENDING") : "NOT_ATTENDING",
    })),
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
    serverId: v.id("guilds"),
  },
  handler: async (ctx, args) => {
    const [user, server] = await Promise.all([
      getUserByDiscordId(ctx, args.userId),
      ctx.db.get(args.serverId),
    ]);

    if (!user || !server) {
      return null;
    }

    const serverDiscordId = getGuildDiscordId(server);
    const discordAccess = await ctx.db
      .query("discordMemberAccess")
      .withIndex("guildId_userId", (q) => q.eq("guildId", serverDiscordId).eq("userId", args.userId))
      .unique();

    const canAccess =
      user.guildId === serverDiscordId ||
      user.managedGuildIds.includes(serverDiscordId) ||
      user.mercenaryGuildIds.includes(serverDiscordId) ||
      Boolean(discordAccess?.hasDashboardAccess);

    if (!canAccess) {
      return null;
    }

    const canAdmin = server.adminIds.includes(args.userId) || Boolean(discordAccess?.isAdmin);
    const [events, topicPresets, squadPresets, groups, assignments, discordConfig] = await Promise.all([
      ctx.db.query("events").withIndex("guildId", (q) => q.eq("guildId", serverDiscordId)).collect(),
      ctx.db.query("topicPresets").withIndex("guildId", (q) => q.eq("guildId", serverDiscordId)).collect(),
      ctx.db.query("squadPresets").withIndex("guildId", (q) => q.eq("guildId", serverDiscordId)).collect(),
      ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", serverDiscordId)).collect(),
      ctx.db.query("userAssignments").withIndex("serverId", (q) => q.eq("serverId", serverDiscordId)).collect(),
      ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", serverDiscordId)).unique(),
    ]);

    const eventRosters = await Promise.all(
      events.map((event) =>
        ctx.db.query("rosters").withIndex("eventId", (q) => q.eq("eventId", event._id)).unique(),
      ),
    );
    const relevantRosters = eventRosters.filter((roster): roster is NonNullable<typeof roster> => Boolean(roster));

    const groupNameById = new Map(groups.map((group) => [String(group._id), group.name]));

    return {
      user: normalizeUserDoc(user),
      server: normalizeGuildDoc(server),
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
      uniqueIds.map((userId) => getUserByDiscordId(ctx, userId)),
    );

    return users
      .filter((user): user is NonNullable<typeof user> => Boolean(user))
      .map((user) => normalizeUserDoc(user));
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    return (await ctx.db.query("users").collect()).map((user) => normalizeUserDoc(user));
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
      getUserByDiscordId(ctx, assignment.userId),
      ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", assignment.serverId)).collect(),
    ]);

    const groupNameById = new Map(groups.map((group) => [String(group._id), group.name]));
    const normalizedAssignment = normalizeAssignmentDoc(assignment, groupNameById);

    return {
      ...normalizedAssignment,
      user: user ? normalizeUserDoc(user) : user,
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

export const getRosterDetail = query({
  args: {
    userId: v.string(),
    serverId: v.id("guilds"),
    rosterId: v.id("rosters"),
  },
  handler: async (ctx, args) => {
    const [user, server, roster] = await Promise.all([
      getUserByDiscordId(ctx, args.userId),
      ctx.db.get(args.serverId),
      ctx.db.get(args.rosterId),
    ]);

    if (!user || !server || !roster) {
      return null;
    }

    const serverDiscordId = getGuildDiscordId(server);
    if (roster.eventId === undefined) {
      return null;
    }

    const event = await ctx.db.get(roster.eventId);
    if (!event || event.guildId !== serverDiscordId) {
      return null;
    }

    const discordAccess = await ctx.db
      .query("discordMemberAccess")
      .withIndex("guildId_userId", (q) => q.eq("guildId", serverDiscordId).eq("userId", args.userId))
      .unique();

    const canAccess =
      user.guildId === serverDiscordId ||
      user.managedGuildIds.includes(serverDiscordId) ||
      user.mercenaryGuildIds.includes(serverDiscordId) ||
      Boolean(discordAccess?.hasDashboardAccess);

    if (!canAccess) {
      return null;
    }

    const canAdmin = server.adminIds.includes(args.userId) || Boolean(discordAccess?.isAdmin);
    const [groups, assignments, discordConfig] = await Promise.all([
      ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", serverDiscordId)).collect(),
      ctx.db.query("userAssignments").withIndex("serverId", (q) => q.eq("serverId", serverDiscordId)).collect(),
      ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", serverDiscordId)).unique(),
    ]);

    const groupNameById = new Map(groups.map((group) => [String(group._id), group.name]));
    const relevantUserIds = [...new Set([
      ...assignments.map((assignment) => assignment.userId),
      ...normalizeEventDoc(event).participants.map((participant) => participant.userId),
      ...roster.reservePlayerIds,
      ...roster.notAttendingPlayerIds,
      ...roster.squads.flatMap((squad) => squad.players.map((player) => player.id).filter(Boolean) as string[]),
    ])];
    const users = await Promise.all(relevantUserIds.map((userId) => getUserByDiscordId(ctx, userId)));

    return {
      canAdmin,
      event: normalizeEventDoc(event),
      roster: {
        ...normalizeDoc(roster),
        guildId: serverDiscordId,
      },
      users: users
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .map((item) => normalizeUserDoc(item)),
      groups: groups.map(normalizeDoc),
      assignments: assignments.map((assignment) => normalizeAssignmentDoc(assignment, groupNameById)),
      discordConfig: discordConfig ? normalizeDoc(discordConfig) : null,
    };
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
