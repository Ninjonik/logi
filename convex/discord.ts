import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getGuildById, getGuildDiscordId, getUserByDiscordId, getUserDiscordId } from "./identity";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

function assertInternalSecret(secret: string) {
  if (secret !== INTERNAL_AUTH_SECRET) {
    throw new Error("Unauthorized.");
  }
}

function normalizeDoc<T extends { _id: unknown }>(doc: T) {
  return {
    ...doc,
    id: String(doc._id),
  };
}

function normalizeConfigDoc<T extends { _id: unknown; defaultLanguage?: "en" | "cs" }>(doc: T) {
  return {
    ...normalizeDoc(doc),
    defaultLanguage: doc.defaultLanguage ?? "en",
  };
}

function normalizeGuildDoc<T extends { _id: unknown; discordId?: string; id?: string }>(doc: T) {
  return {
    ...normalizeDoc(doc),
    discordId: doc.discordId ?? doc.id ?? String(doc._id),
  };
}

const ticketModalQuestionValidator = v.object({
  id: v.string(),
  label: v.string(),
  placeholder: v.optional(v.string()),
  style: v.union(v.literal("short"), v.literal("paragraph")),
  required: v.boolean(),
});

const ticketCategoryValidator = v.object({
  id: v.string(),
  emoji: v.optional(v.string()),
  label: v.optional(v.string()),
  description: v.optional(v.string()),
  supportRoleIds: v.array(v.string()),
  modalQuestions: v.array(ticketModalQuestionValidator),
});

const membershipCategoryValidator = v.object({
  id: v.string(),
  emoji: v.optional(v.string()),
  label: v.optional(v.string()),
  description: v.optional(v.string()),
  supportRoleIds: v.array(v.string()),
  recruitRoleId: v.optional(v.string()),
  finalRoleId: v.optional(v.string()),
  modalQuestions: v.array(ticketModalQuestionValidator),
  assignmentType: v.union(v.literal("member"), v.literal("mercenary")),
});

const ticketSettingsValidator = v.object({
  enabled: v.boolean(),
  submitChannelId: v.optional(v.string()),
  ticketParentChannelId: v.optional(v.string()),
  panelTitle: v.string(),
  panelDescription: v.string(),
  panelImageUrl: v.optional(v.string()),
  categories: v.array(ticketCategoryValidator),
});

const membershipSettingsValidator = v.object({
  enabled: v.boolean(),
  submitChannelId: v.optional(v.string()),
  applicationParentChannelId: v.optional(v.string()),
  panelTitle: v.string(),
  panelDescription: v.string(),
  panelImageUrl: v.optional(v.string()),
  autoAssignRecruitOnApply: v.boolean(),
  categories: v.array(membershipCategoryValidator),
});

function normalizeUserDoc<T extends { _id: unknown; discordId?: string; id?: string }>(doc: T) {
  return {
    ...doc,
    id: String(doc._id),
    discordId: getUserDiscordId(doc),
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

function normalizeEventDoc<T extends {
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
  matchStatsId?: unknown;
  participants?: Array<{ userId: string; status: "attending" | "not_attending"; group?: string | null; completed?: "passed" | "failed"; updatedAt: string }>;
  signUps?: Array<{ userId: string; group?: string | null }>;
  attendanceReminderLog?: Array<{ userId: string; offsetHours: number; sentAt: string }>;
  updatedAt?: string;
  createdAt?: string;
}>(event: T) {
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
    matchStatsId: event.matchStatsId ? String(event.matchStatsId) : undefined,
    matchId: event.matchStatsId ? String(event.matchStatsId) : undefined,
    participants,
    signUps: participants.map((participant) => ({
      userId: participant.userId,
      group: participant.status === "attending" ? (participant.group ?? "ATTENDING") : "NOT_ATTENDING",
    })),
    attendanceReminderLog: event.attendanceReminderLog ?? [],
  };
}

export const getConfigByGuild = query({
  args: {
    guildId: v.id("guilds"),
  },
  handler: async (ctx, args) => {
    const guild = await getGuildById(ctx, args.guildId);
    if (!guild) {
      return null;
    }
    const config = await ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", getGuildDiscordId(guild)))
      .unique();

    return config ? normalizeConfigDoc(config) : null;
  },
});

export const upsertConfig = mutation({
  args: {
    secret: v.string(),
    guildId: v.id("guilds"),
    timezone: v.string(),
    defaultLanguage: v.union(v.literal("en"), v.literal("cs")),
    announcementsChannelId: v.optional(v.string()),
    forumCategoryId: v.optional(v.string()),
    meetingChannelId: v.optional(v.string()),
    clanRoleId: v.optional(v.string()),
    dashboardAdminRoleId: v.optional(v.string()),
    ticketSettings: v.optional(ticketSettingsValidator),
    membershipSettings: v.optional(membershipSettingsValidator),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const guild = await getGuildById(ctx, args.guildId);
    if (!guild) {
      throw new Error("Server not found.");
    }
    const guildDiscordId = getGuildDiscordId(guild);

    const now = new Date().toISOString();
    const payload = {
      timezone: args.timezone,
      defaultLanguage: args.defaultLanguage,
      announcementsChannelId: args.announcementsChannelId?.trim() || undefined,
      forumCategoryId: args.forumCategoryId?.trim() || undefined,
      meetingChannelId: args.meetingChannelId?.trim() || undefined,
      clanRoleId: args.clanRoleId?.trim() || undefined,
      dashboardAdminRoleId: args.dashboardAdminRoleId?.trim() || undefined,
      ticketSettings: args.ticketSettings,
      membershipSettings: args.membershipSettings,
      updatedAt: now,
    };

    const existing = await ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return String(existing._id);
    }

    const configId = await ctx.db.insert("discordConfigs", {
      guildId: guildDiscordId,
      ...payload,
      createdAt: now,
    });

    return String(configId);
  },
});

export const updateTicketPanelState = mutation({
  args: {
    secret: v.string(),
    guildId: v.string(),
    ticketPanelMessageId: v.optional(v.string()),
    ticketPanelLastConfigUpdatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const config = await ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (!config) {
      throw new Error("Discord config not found.");
    }

    await ctx.db.patch(config._id, {
      ticketPanelMessageId: args.ticketPanelMessageId,
      ticketPanelLastConfigUpdatedAt: args.ticketPanelLastConfigUpdatedAt,
    });

    return { ok: true };
  },
});

export const updateMembershipPanelState = mutation({
  args: {
    secret: v.string(),
    guildId: v.string(),
    membershipPanelMessageId: v.optional(v.string()),
    membershipPanelLastConfigUpdatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const config = await ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (!config) {
      throw new Error("Discord config not found.");
    }

    await ctx.db.patch(config._id, {
      membershipPanelMessageId: args.membershipPanelMessageId,
      membershipPanelLastConfigUpdatedAt: args.membershipPanelLastConfigUpdatedAt,
    });

    return { ok: true };
  },
});

export const backfillDefaultLanguages = mutation({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const now = new Date().toISOString();
    const guilds = await ctx.db.query("guilds").collect();
    const configs = await ctx.db.query("discordConfigs").collect();
    const configByGuildId = new Map(configs.map((config) => [config.guildId, config]));

    let patchedCount = 0;
    let insertedCount = 0;

    for (const config of configs) {
      if (config.defaultLanguage) {
        continue;
      }

      await ctx.db.patch(config._id, {
        defaultLanguage: "en",
        updatedAt: now,
      });
      patchedCount += 1;
    }

    for (const guild of guilds) {
      if (configByGuildId.has(getGuildDiscordId(guild))) {
        continue;
      }

      await ctx.db.insert("discordConfigs", {
        guildId: getGuildDiscordId(guild),
        timezone: "UTC",
        defaultLanguage: "en",
        createdAt: now,
        updatedAt: now,
      });
      insertedCount += 1;
    }

    return {
      patchedCount,
      insertedCount,
    };
  },
});

export const listSyncPayloads = query({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const [configs, groups, events, topicPresets, syncStates, rosters] = await Promise.all([
      ctx.db.query("discordConfigs").collect(),
      ctx.db.query("groups").collect(),
      ctx.db.query("events").collect(),
      ctx.db.query("topicPresets").collect(),
      ctx.db.query("discordEventSyncs").collect(),
      ctx.db.query("rosters").collect(),
    ]);

    return configs.map((config) => {
      const guildGroups = groups
        .filter((group) => group.guildId === config.guildId)
        .map((group) => normalizeDoc(group));
      const guildEvents = events
        .filter((event) => event.guildId === config.guildId)
        .map((event) => normalizeEventDoc(event));
      const guildTopicPresets = topicPresets
        .filter((preset) => preset.guildId === config.guildId)
        .map((preset) => normalizeDoc(preset));
      const guildSyncStates = syncStates
        .filter((state) => state.guildId === config.guildId)
        .map((state) => normalizeDoc(state));
      const guildRosters = rosters
        .filter((roster) => guildEvents.some((event) => String(roster.eventId) === event.id))
        .map((roster) => normalizeDoc(roster));

      return {
        config: normalizeConfigDoc(config),
        groups: guildGroups,
        events: guildEvents,
        rosters: guildRosters,
        topicPresets: guildTopicPresets,
        syncStates: guildSyncStates,
      };
    });
  },
});

export const listGuildCacheSnapshot = query({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const [guilds, configs, groups, squadPresets, topicPresets] = await Promise.all([
      ctx.db.query("guilds").collect(),
      ctx.db.query("discordConfigs").collect(),
      ctx.db.query("groups").collect(),
      ctx.db.query("squadPresets").collect(),
      ctx.db.query("topicPresets").collect(),
    ]);

    return {
      guilds: guilds.map(normalizeGuildDoc),
      configs: configs.map(normalizeConfigDoc),
      groups: groups.map(normalizeDoc),
      squadPresets: squadPresets.map(normalizeDoc),
      topicPresets: topicPresets.map(normalizeDoc),
    };
  },
});

export const listEventSyncIndex = query({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const [events, rosters] = await Promise.all([
      ctx.db.query("events").collect(),
      ctx.db.query("rosters").collect(),
    ]);

    return {
      events: events.map((event) => {
        const normalized = normalizeEventDoc(event);
        return {
          id: normalized.id,
          guildId: normalized.guildId,
          status: normalized.status,
          updatedAt: normalized.updatedAt,
        };
      }),
      rosters: rosters.map((roster) => ({
        ...normalizeDoc(roster),
        eventId: String(roster.eventId),
      })),
    };
  },
});

export const getEventSyncContext = query({
  args: {
    secret: v.string(),
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      return null;
    }

    const [roster, syncState] = await Promise.all([
      ctx.db.query("rosters").withIndex("eventId", (q) => q.eq("eventId", args.eventId)).unique(),
      ctx.db.query("discordEventSyncs").withIndex("eventId", (q) => q.eq("eventId", args.eventId)).unique(),
    ]);

    return {
      event: normalizeEventDoc(event),
      roster: roster ? { ...normalizeDoc(roster), eventId: String(roster.eventId) } : null,
      syncState: syncState ? normalizeDoc(syncState) : null,
    };
  },
});

export const getEventSignupContext = query({
  args: {
    secret: v.string(),
    guildId: v.string(),
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const [config, event, groups, roster] = await Promise.all([
      ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", args.guildId)).unique(),
      ctx.db.get(args.eventId),
      ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", args.guildId)).collect(),
      ctx.db.query("rosters").withIndex("eventId", (q) => q.eq("eventId", args.eventId)).unique(),
    ]);

    if (!config || !event || event.guildId !== args.guildId) {
      return null;
    }

    return {
      config: normalizeConfigDoc(config),
      event: normalizeEventDoc(event),
      groups: groups.map(normalizeDoc),
      roster: roster ? normalizeDoc(roster) : null,
    };
  },
});

export const getEventInteractionContext = query({
  args: {
    secret: v.string(),
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      return null;
    }

    const [config, groups, roster] = await Promise.all([
      ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", event.guildId)).unique(),
      ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", event.guildId)).collect(),
      ctx.db.query("rosters").withIndex("eventId", (q) => q.eq("eventId", args.eventId)).unique(),
    ]);

    if (!config) {
      return null;
    }

    return {
      config: normalizeConfigDoc(config),
      event: normalizeEventDoc(event),
      groups: groups.map(normalizeDoc),
      roster: roster ? normalizeDoc(roster) : null,
    };
  },
});

export const updateEventSyncState = mutation({
  args: {
    secret: v.string(),
    eventId: v.id("events"),
    guildId: v.string(),
    announcementChannelId: v.optional(v.string()),
    announcementMessageId: v.optional(v.string()),
    scheduledEventId: v.optional(v.string()),
    scheduledEventStatus: v.optional(v.union(
      v.literal("scheduled"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("canceled"),
    )),
    forumChannelId: v.optional(v.string()),
    forumThreadId: v.optional(v.string()),
    infoMessageId: v.optional(v.string()),
    topicMessageIds: v.array(v.string()),
    lastEventUpdatedAt: v.optional(v.string()),
    lastRosterUpdatedAt: v.optional(v.string()),
    lastConfigUpdatedAt: v.optional(v.string()),
    lastSyncedAt: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const now = new Date().toISOString();
    const payload = {
      guildId: args.guildId,
      announcementChannelId: args.announcementChannelId,
      announcementMessageId: args.announcementMessageId,
      scheduledEventId: args.scheduledEventId,
      scheduledEventStatus: args.scheduledEventStatus,
      forumChannelId: args.forumChannelId,
      forumThreadId: args.forumThreadId,
      infoMessageId: args.infoMessageId,
      topicMessageIds: args.topicMessageIds,
      lastEventUpdatedAt: args.lastEventUpdatedAt,
      lastRosterUpdatedAt: args.lastRosterUpdatedAt,
      lastConfigUpdatedAt: args.lastConfigUpdatedAt,
      lastSyncedAt: args.lastSyncedAt,
      updatedAt: now,
    };

    const existing = await ctx.db
      .query("discordEventSyncs")
      .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return String(existing._id);
    }

    const stateId = await ctx.db.insert("discordEventSyncs", {
      eventId: args.eventId,
      ...payload,
      createdAt: now,
    });

    return String(stateId);
  },
});

export const getTicketCategoryContext = query({
  args: {
    secret: v.string(),
    guildId: v.string(),
    categoryId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const config = await ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (!config?.ticketSettings?.enabled) {
      return null;
    }

    const category = config.ticketSettings.categories.find((item) => item.id === args.categoryId);
    if (!category) {
      return null;
    }

    return {
      config: normalizeConfigDoc(config),
      category,
    };
  },
});

export const getMembershipCategoryContext = query({
  args: {
    secret: v.string(),
    guildId: v.string(),
    categoryId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const config = await ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (!config?.membershipSettings?.enabled) {
      return null;
    }

    const category = config.membershipSettings.categories.find((item) => item.id === args.categoryId);
    if (!category) {
      return null;
    }

    return {
      config: normalizeConfigDoc(config),
      category,
    };
  },
});

export const getMembershipApplicationPrereq = query({
  args: {
    secret: v.string(),
    guildId: v.string(),
    categoryId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const config = await ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (!config?.membershipSettings?.enabled) {
      return null;
    }

    const category = config.membershipSettings.categories.find((item) => item.id === args.categoryId);
    if (!category) {
      return null;
    }

    const [user, assignment, openApplications] = await Promise.all([
      getUserByDiscordId(ctx, args.userId),
      ctx.db
        .query("userAssignments")
        .withIndex("serverId_userId", (q) => q.eq("serverId", args.guildId).eq("userId", args.userId))
        .unique(),
      ctx.db
        .query("membershipApplicationThreads")
        .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
        .collect(),
    ]);

    return {
      config: normalizeConfigDoc(config),
      category,
      user: user ? normalizeUserDoc(user) : null,
      assignment: assignment ? normalizeDoc(assignment) : null,
      hasOpenApplication: openApplications.some((application) => application.creatorId === args.userId && application.status === "open"),
    };
  },
});

export const createPlatformIdLinkToken = mutation({
  args: {
    secret: v.string(),
    guildId: v.string(),
    categoryId: v.string(),
    userId: v.string(),
    userName: v.string(),
    userAvatar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    const token = crypto.randomUUID();
    const existingTokens = await ctx.db
      .query("platformIdLinkTokens")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();

    await Promise.all(existingTokens.map((doc) => ctx.db.delete(doc._id)));

    await ctx.db.insert("platformIdLinkTokens", {
      token,
      guildId: args.guildId,
      userId: args.userId,
      userName: args.userName,
      userAvatar: args.userAvatar,
      categoryId: args.categoryId,
      expiresAt,
      consumedAt: undefined,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    return {
      token,
      expiresAt,
    };
  },
});

export const getPlatformIdLinkToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("platformIdLinkTokens")
      .withIndex("token", (q) => q.eq("token", args.token))
      .unique();

    if (!doc) {
      return null;
    }

    return normalizeDoc(doc);
  },
});

export const consumePlatformIdLinkToken = mutation({
  args: {
    secret: v.string(),
    token: v.string(),
    platformId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const doc = await ctx.db
      .query("platformIdLinkTokens")
      .withIndex("token", (q) => q.eq("token", args.token))
      .unique();

    if (!doc) {
      throw new Error("Token not found.");
    }

    if (doc.consumedAt) {
      throw new Error("Token already used.");
    }

    if (new Date(doc.expiresAt).getTime() < Date.now()) {
      throw new Error("Token expired.");
    }

    const existingUser = await getUserByDiscordId(ctx, doc.userId);
    const now = new Date().toISOString();
    const normalizedPlatformId = args.platformId.trim();

    if (!normalizedPlatformId) {
      throw new Error("Platform ID is required.");
    }

    if (existingUser) {
      const nextPlatformIds = [...new Set([...(existingUser.platformIds ?? []), normalizedPlatformId])];
      await ctx.db.patch(existingUser._id, {
        name: existingUser.name || doc.userName,
        avatar: existingUser.avatar || doc.userAvatar || "https://cdn.discordapp.com/embed/avatars/0.png",
        platformIds: nextPlatformIds,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("users", {
        discordId: doc.userId,
        id: doc.userId,
        name: doc.userName,
        platformIds: [normalizedPlatformId],
        avatar: doc.userAvatar || "https://cdn.discordapp.com/embed/avatars/0.png",
        managedGuildIds: [],
        guildId: undefined,
        mercenaryGuildIds: [],
        isStreamer: false,
        score: 0,
        performance: undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(doc._id, {
      consumedAt: now,
      updatedAt: now,
    });

    return { ok: true };
  },
});

export const createTicketThread = mutation({
  args: {
    secret: v.string(),
    guildId: v.string(),
    threadId: v.string(),
    parentChannelId: v.string(),
    creatorId: v.string(),
    categoryId: v.string(),
    transcriptMessageId: v.optional(v.string()),
    answers: v.array(v.object({
      questionId: v.string(),
      label: v.string(),
      value: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const config = await ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (!config?.ticketSettings?.enabled) {
      throw new Error("Tickets are not enabled.");
    }

    const category = config.ticketSettings.categories.find((item) => item.id === args.categoryId);
    if (!category) {
      throw new Error("Ticket category not found.");
    }

    const nextTicketNumber = (config.ticketCounter ?? 0) + 1;
    const now = new Date().toISOString();

    await ctx.db.patch(config._id, {
      ticketCounter: nextTicketNumber,
    });

    const threadRecordId = await ctx.db.insert("ticketThreads", {
      guildId: args.guildId,
      threadId: args.threadId,
      parentChannelId: args.parentChannelId,
      creatorId: args.creatorId,
      categoryId: category.id,
      categoryLabel: category.label?.trim() || category.id,
      ticketNumber: nextTicketNumber,
      status: "open",
      transcriptMessageId: args.transcriptMessageId,
      answers: args.answers,
      openedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return {
      ticket: {
        id: String(threadRecordId),
        threadId: args.threadId,
        ticketNumber: nextTicketNumber,
        categoryId: category.id,
        categoryLabel: category.label?.trim() || category.id,
      },
      category,
      config: normalizeConfigDoc(config),
    };
  },
});

export const createMembershipApplicationThread = mutation({
  args: {
    secret: v.string(),
    guildId: v.string(),
    threadId: v.string(),
    parentChannelId: v.string(),
    creatorId: v.string(),
    categoryId: v.string(),
    assignmentType: v.union(v.literal("member"), v.literal("mercenary")),
    assignmentId: v.optional(v.id("userAssignments")),
    transcriptMessageId: v.optional(v.string()),
    answers: v.array(v.object({
      questionId: v.string(),
      label: v.string(),
      value: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const config = await ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (!config?.membershipSettings?.enabled) {
      throw new Error("Membership applications are not enabled.");
    }

    const category = config.membershipSettings.categories.find((item) => item.id === args.categoryId);
    if (!category) {
      throw new Error("Application category not found.");
    }

    const nextApplicationNumber = (config.membershipApplicationCounter ?? 0) + 1;
    const now = new Date().toISOString();

    await ctx.db.patch(config._id, {
      membershipApplicationCounter: nextApplicationNumber,
    });

    const applicationId = await ctx.db.insert("membershipApplicationThreads", {
      guildId: args.guildId,
      threadId: args.threadId,
      parentChannelId: args.parentChannelId,
      creatorId: args.creatorId,
      categoryId: category.id,
      categoryLabel: category.label?.trim() || category.id,
      assignmentType: args.assignmentType,
      applicationNumber: nextApplicationNumber,
      assignmentId: args.assignmentId,
      transcriptMessageId: args.transcriptMessageId,
      answers: args.answers,
      status: "open",
      openedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return {
      application: {
        id: String(applicationId),
        threadId: args.threadId,
        applicationNumber: nextApplicationNumber,
        categoryLabel: category.label?.trim() || category.id,
      },
      category,
      config: normalizeConfigDoc(config),
    };
  },
});

export const getTicketThreadContext = query({
  args: {
    secret: v.string(),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const ticket = await ctx.db
      .query("ticketThreads")
      .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!ticket) {
      return null;
    }

    const config = await ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", ticket.guildId))
      .unique();

    if (!config) {
      return null;
    }

    const category = config.ticketSettings?.categories.find((item) => item.id === ticket.categoryId) ?? null;

    return {
      config: normalizeConfigDoc(config),
      ticket: normalizeDoc(ticket),
      category,
    };
  },
});

export const getMembershipApplicationThreadContext = query({
  args: {
    secret: v.string(),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const application = await ctx.db
      .query("membershipApplicationThreads")
      .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!application) {
      return null;
    }

    const [config, assignment] = await Promise.all([
      ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", application.guildId)).unique(),
      application.assignmentId ? ctx.db.get(application.assignmentId) : null,
    ]);

    if (!config) {
      return null;
    }

    const category = config.membershipSettings?.categories.find((item) => item.id === application.categoryId) ?? null;

    return {
      config: normalizeConfigDoc(config),
      application: normalizeDoc(application),
      assignment: assignment ? normalizeDoc(assignment) : null,
      category,
    };
  },
});

export const getMembershipApplicationByAssignment = query({
  args: {
    secret: v.string(),
    assignmentId: v.id("userAssignments"),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const applications = await ctx.db.query("membershipApplicationThreads").collect();
    const application = applications.find((item) => item.assignmentId === args.assignmentId) ?? null;

    return application ? normalizeDoc(application) : null;
  },
});

export const closeTicketThread = mutation({
  args: {
    secret: v.string(),
    threadId: v.string(),
    closedByUserId: v.string(),
    closeReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const ticket = await ctx.db
      .query("ticketThreads")
      .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!ticket) {
      throw new Error("Ticket not found.");
    }

    const now = new Date().toISOString();

    await ctx.db.patch(ticket._id, {
      status: "closed",
      closedAt: now,
      closedByUserId: args.closedByUserId,
      closeReason: args.closeReason?.trim() || undefined,
      updatedAt: now,
    });

    return { ok: true };
  },
});

export const closeMembershipApplicationThread = mutation({
  args: {
    secret: v.string(),
    threadId: v.string(),
    closedByUserId: v.string(),
    closeReason: v.optional(v.string()),
    closeOutcome: v.union(
      v.literal("denied"),
      v.literal("pending"),
      v.literal("recruit"),
      v.literal("member"),
      v.literal("mercenary"),
    ),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const application = await ctx.db
      .query("membershipApplicationThreads")
      .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!application) {
      throw new Error("Application not found.");
    }

    const now = new Date().toISOString();
    await ctx.db.patch(application._id, {
      status: "closed",
      closeOutcome: args.closeOutcome,
      closedAt: now,
      closedByUserId: args.closedByUserId,
      closeReason: args.closeReason?.trim() || undefined,
      updatedAt: now,
    });

    return { ok: true };
  },
});

export const updateTicketTranscriptMessage = mutation({
  args: {
    secret: v.string(),
    threadId: v.string(),
    transcriptMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const ticket = await ctx.db
      .query("ticketThreads")
      .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!ticket) {
      throw new Error("Ticket not found.");
    }

    await ctx.db.patch(ticket._id, {
      transcriptMessageId: args.transcriptMessageId,
      updatedAt: new Date().toISOString(),
    });

    return { ok: true };
  },
});

export const updateMembershipApplicationTranscriptMessage = mutation({
  args: {
    secret: v.string(),
    threadId: v.string(),
    transcriptMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const application = await ctx.db
      .query("membershipApplicationThreads")
      .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!application) {
      throw new Error("Application not found.");
    }

    await ctx.db.patch(application._id, {
      transcriptMessageId: args.transcriptMessageId,
      updatedAt: new Date().toISOString(),
    });

    return { ok: true };
  },
});

export const getRosterImageContext = query({
  args: {
    secret: v.string(),
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      return null;
    }

    const [roster, groups, assignments, config] = await Promise.all([
      ctx.db.query("rosters").withIndex("eventId", (q) => q.eq("eventId", args.eventId)).unique(),
      ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", event.guildId)).collect(),
      ctx.db.query("userAssignments").withIndex("serverId", (q) => q.eq("serverId", event.guildId)).collect(),
      ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", event.guildId)).unique(),
    ]);

    if (!roster?.published) {
      return null;
    }

    const userIds = [
      ...new Set([
        ...roster.reservePlayerIds,
        ...roster.notAttendingPlayerIds,
        ...roster.squads.flatMap((squad) => squad.players.map((player) => player.id).filter(Boolean) as string[]),
      ]),
    ];

    const usersRaw = await Promise.all(
      userIds.map((userId) => getUserByDiscordId(ctx, userId)),
    );
    const users = usersRaw.filter((user): user is NonNullable<(typeof usersRaw)[number]> => Boolean(user));

    return {
      event: normalizeEventDoc(event),
      roster: normalizeDoc(roster),
      config: config ? normalizeConfigDoc(config) : { guildId: event.guildId, timezone: "UTC", defaultLanguage: "en" as const },
      groups: groups.map(normalizeDoc),
      assignments: assignments.map(normalizeDoc),
      users: users.map(normalizeUserDoc),
    };
  },
});

export const syncMemberAccess = mutation({
  args: {
    secret: v.string(),
    guildId: v.string(),
    members: v.array(
      v.object({
        userId: v.string(),
        roleIds: v.array(v.string()),
        voiceChannelId: v.optional(v.string()),
        isAdmin: v.boolean(),
        hasDashboardAccess: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("discordMemberAccess")
      .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
      .collect();

    const existingByUserId = new Map(existing.map((item) => [item.userId, item]));
    const nextUserIds = new Set(args.members.map((member) => member.userId));

    for (const member of args.members) {
      const current = existingByUserId.get(member.userId);
      if (current) {
        await ctx.db.patch(current._id, {
          roleIds: member.roleIds,
          voiceChannelId: member.voiceChannelId,
          isAdmin: member.isAdmin,
          hasDashboardAccess: member.hasDashboardAccess,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("discordMemberAccess", {
          guildId: args.guildId,
          userId: member.userId,
          roleIds: member.roleIds,
          voiceChannelId: member.voiceChannelId,
          isAdmin: member.isAdmin,
          hasDashboardAccess: member.hasDashboardAccess,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    for (const stale of existing) {
      if (!nextUserIds.has(stale.userId)) {
        await ctx.db.delete(stale._id);
      }
    }

  return { ok: true };
  },
});

export const confirmRosterAttendanceFromMeetingChannel = mutation({
  args: {
    secret: v.string(),
    guildId: v.string(),
    rosterId: v.id("rosters"),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const [config, roster] = await Promise.all([
      ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", args.guildId)).unique(),
      ctx.db.get(args.rosterId),
    ]);

    if (!config?.meetingChannelId) {
      throw new Error("Meeting channel is not configured.");
    }

    if (!roster) {
      throw new Error("Roster not found.");
    }

    const event = await ctx.db.get(roster.eventId);
    if (!event || event.guildId !== args.guildId) {
      throw new Error("Roster does not belong to this server.");
    }

    const memberAccess = await ctx.db
      .query("discordMemberAccess")
      .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
      .collect();

    const memberIdsInMeetingChannel = new Set(
      memberAccess
        .filter((member) => member.voiceChannelId === config.meetingChannelId)
        .map((member) => member.userId),
    );

    let rosteredCount = 0;
    let updatedCount = 0;
    const updatedUserIds = new Set<string>();

    const squads = roster.squads.map((squad) => ({
      ...squad,
      players: squad.players.map((player) => {
        if (!player.id || !memberIdsInMeetingChannel.has(player.id)) {
          return player;
        }

        rosteredCount += 1;

        if (player.ack && player.confirmed) {
          return player;
        }

        updatedCount += 1;
        updatedUserIds.add(player.id);
        return {
          ...player,
          ack: true,
          confirmed: true,
        };
      }),
    }));

    if (updatedCount > 0) {
      await ctx.db.patch(roster._id, {
        squads,
        updatedAt: new Date().toISOString(),
      });
    }

    return {
      matchedVoiceCount: memberIdsInMeetingChannel.size,
      rosteredCount,
      updatedCount,
      updatedUserIds: Array.from(updatedUserIds),
    };
  },
});
