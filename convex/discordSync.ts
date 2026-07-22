import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  assertInternalSecret,
  normalizeConfigDoc,
  normalizeDoc,
  normalizeEventDoc,
  normalizeGuildDoc,
} from "./discord-shared";

export const listSyncPayloads = query({
  args: { secret: v.string() },
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
      const guildGroups = groups.filter((group) => group.guildId === config.guildId).map(normalizeDoc);
      const guildEvents = events.filter((event) => event.guildId === config.guildId).map(normalizeEventDoc);
      const guildTopicPresets = topicPresets.filter((preset) => preset.guildId === config.guildId).map(normalizeDoc);
      const guildSyncStates = syncStates.filter((state) => state.guildId === config.guildId).map(normalizeDoc);
      const guildRosters = rosters
        .filter((roster) => guildEvents.some((event) => String(roster.eventId) === event.id))
        .map(normalizeDoc);

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
  args: { secret: v.string() },
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
  args: { secret: v.string() },
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
  args: { secret: v.string(), eventId: v.id("events") },
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
  args: { secret: v.string(), guildId: v.string(), eventId: v.id("events") },
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
  args: { secret: v.string(), eventId: v.id("events") },
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
    scheduledEventStatus: v.optional(v.union(v.literal("scheduled"), v.literal("active"), v.literal("completed"), v.literal("canceled"))),
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

    const existing = await ctx.db.query("discordEventSyncs").withIndex("eventId", (q) => q.eq("eventId", args.eventId)).unique();

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
    members: v.array(v.object({
      userId: v.string(),
      roleIds: v.array(v.string()),
      voiceChannelId: v.optional(v.string()),
      isAdmin: v.boolean(),
      hasDashboardAccess: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const now = new Date().toISOString();
    const existing = await ctx.db.query("discordMemberAccess").withIndex("guildId", (q) => q.eq("guildId", args.guildId)).collect();
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
