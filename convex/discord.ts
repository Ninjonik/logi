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

export const getConfigByGuild = query({
  args: {
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
      .unique();

    return config ? normalizeDoc(config) : null;
  },
});

export const upsertConfig = mutation({
  args: {
    secret: v.string(),
    guildId: v.string(),
    timezone: v.string(),
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

export const listSyncPayloads = query({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const [configs, groups, events, topicPresets, syncStates] = await Promise.all([
      ctx.db.query("discordConfigs").collect(),
      ctx.db.query("groups").collect(),
      ctx.db.query("events").collect(),
      ctx.db.query("topicPresets").collect(),
      ctx.db.query("discordEventSyncs").collect(),
    ]);

    return configs.map((config) => {
      const guildGroups = groups
        .filter((group) => group.guildId === config.guildId)
        .map((group) => normalizeDoc(group));
      const guildEvents = events
        .filter((event) => event.guildId === config.guildId)
        .map((event) => normalizeDoc(event));
      const guildTopicPresets = topicPresets
        .filter((preset) => preset.guildId === config.guildId)
        .map((preset) => normalizeDoc(preset));
      const guildSyncStates = syncStates
        .filter((state) => state.guildId === config.guildId)
        .map((state) => normalizeDoc(state));

      return {
        config: normalizeDoc(config),
        groups: guildGroups,
        events: guildEvents,
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

    const [config, event, groups] = await Promise.all([
      ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", args.guildId)).unique(),
      ctx.db.get(args.eventId),
      ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", args.guildId)).collect(),
    ]);

    if (!config || !event || event.guildId !== args.guildId) {
      return null;
    }

    return {
      config: normalizeDoc(config),
      event: normalizeDoc(event),
      groups: groups.map(normalizeDoc),
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
