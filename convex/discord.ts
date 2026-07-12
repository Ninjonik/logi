import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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

function normalizeUserDoc<T extends { _id: unknown; id: string }>(doc: T) {
  return {
    ...doc,
    _id: String(doc._id),
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

function normalizeEventDoc<T extends {
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
}>(event: T) {
  return {
    ...normalizeDoc(event),
    status: event.status ?? deriveEventStatus(event),
    statusUpdatedAt: event.statusUpdatedAt ?? event.updatedAt ?? event.createdAt ?? new Date().toISOString(),
    concludedAt: event.concludedAt,
    attendanceReminderLog: event.attendanceReminderLog ?? [],
  };
}

export const getConfigByGuild = query({
  args: {
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
      .unique();

    return config ? normalizeConfigDoc(config) : null;
  },
});

export const upsertConfig = mutation({
  args: {
    secret: v.string(),
    guildId: v.string(),
    timezone: v.string(),
    defaultLanguage: v.union(v.literal("en"), v.literal("cs")),
    announcementsChannelId: v.optional(v.string()),
    forumCategoryId: v.optional(v.string()),
    clanRoleId: v.optional(v.string()),
    dashboardAdminRoleId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const guild = await ctx.db.query("guilds").withIndex("id", (q) => q.eq("id", args.guildId)).unique();
    if (!guild) {
      throw new Error("Server not found.");
    }

    const now = new Date().toISOString();
    const payload = {
      timezone: args.timezone,
      defaultLanguage: args.defaultLanguage,
      announcementsChannelId: args.announcementsChannelId?.trim() || undefined,
      forumCategoryId: args.forumCategoryId?.trim() || undefined,
      clanRoleId: args.clanRoleId?.trim() || undefined,
      dashboardAdminRoleId: args.dashboardAdminRoleId?.trim() || undefined,
      updatedAt: now,
    };

    const existing = await ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return String(existing._id);
    }

    const configId = await ctx.db.insert("discordConfigs", {
        guildId: args.guildId,
        ...payload,
        createdAt: now,
    });

    return String(configId);
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
      if (configByGuildId.has(guild.id)) {
        continue;
      }

      await ctx.db.insert("discordConfigs", {
        guildId: guild.id,
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
      userIds.map((userId) => ctx.db.query("users").withIndex("id", (q) => q.eq("id", userId)).unique()),
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
          isAdmin: member.isAdmin,
          hasDashboardAccess: member.hasDashboardAccess,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("discordMemberAccess", {
          guildId: args.guildId,
          userId: member.userId,
          roleIds: member.roleIds,
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
