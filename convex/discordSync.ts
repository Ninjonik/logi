import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  assertInternalSecret,
  normalizeConfigDoc,
  normalizeCalendarItemDoc,
  normalizeDoc,
  normalizeEventDoc,
  normalizeGuildDoc,
  normalizeUserDoc,
} from "./discord_shared";
import { getGuildDiscordId } from "./identity";

export const listSyncPayloads = query({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const [guilds, configs, groups, events, calendarItems, topicPresets, syncStates, rosters, users] = await Promise.all([
      ctx.db.query("guilds").collect(),
      ctx.db.query("discordConfigs").collect(),
      ctx.db.query("groups").collect(),
      ctx.db.query("events").collect(),
      ctx.db.query("calendarItems").collect(),
      ctx.db.query("topicPresets").collect(),
      ctx.db.query("discordEventSyncs").collect(),
      ctx.db.query("rosters").collect(),
      ctx.db.query("users").collect(),
    ]);

    return configs.map((config) => {
      const normalizedUsers = users.map((user) => normalizeUserDoc(user, { guildId: config.guildId }));
      const guild = guilds.find((item) => getGuildDiscordId(item) === config.guildId);
      const guildGroups = groups.filter((group) => group.guildId === config.guildId).map(normalizeDoc);
      const guildEvents = events.filter((event) => event.guildId === config.guildId).map(normalizeEventDoc);
      const guildCalendarItems = calendarItems.filter((item) => item.guildId === config.guildId).map(normalizeCalendarItemDoc);
      const guildTopicPresets = topicPresets.filter((preset) => preset.guildId === config.guildId).map(normalizeDoc);
      const guildSyncStates = syncStates.filter((state) => state.guildId === config.guildId).map(normalizeDoc);
      const guildRosters = rosters
        .filter((roster) => guildEvents.some((event) => String(roster.eventId) === event.id))
        .map(normalizeDoc);
      const userIds = new Set<string>();

      for (const event of guildEvents) {
        for (const signUp of event.signUps ?? []) {
          userIds.add(signUp.userId);
        }
        for (const participant of event.participants ?? []) {
          userIds.add(participant.userId);
        }
      }

      const userDisplayNames = Object.fromEntries(
        normalizedUsers
          .filter((user) => userIds.has(user.id) || userIds.has(user.discordId))
          .flatMap((user) => {
            const nickname = user.nicknames?.[config.guildId]?.trim();
            const displayName = nickname || user.name?.trim() || user.discordId || user.id;
            return [
              [user.id, displayName],
              [user.discordId, displayName],
            ] as const;
          }),
      );

      return {
        guild: guild ? normalizeGuildDoc(guild) : {
          id: config.guildId,
          discordId: config.guildId,
          name: config.guildId,
          avatar: "",
          botInside: false,
          adminIds: [],
          memberIds: [],
          mercenaryIds: [],
          eventCategories: [],
          calendarItems: [],
          updatedAt: config.updatedAt,
        },
        config: normalizeConfigDoc(config),
        groups: guildGroups,
        userDisplayNames,
        events: guildEvents,
        calendarItems: guildCalendarItems,
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

    const [guilds, configs, groups, calendarItems, squadPresets, topicPresets] = await Promise.all([
      ctx.db.query("guilds").collect(),
      ctx.db.query("discordConfigs").collect(),
      ctx.db.query("groups").collect(),
      ctx.db.query("calendarItems").collect(),
      ctx.db.query("squadPresets").collect(),
      ctx.db.query("topicPresets").collect(),
    ]);

    return {
      guilds: guilds.map(normalizeGuildDoc),
      configs: configs.map(normalizeConfigDoc),
      groups: groups.map(normalizeDoc),
      calendarItems: calendarItems.map(normalizeCalendarItemDoc),
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

    const [config, event, groups, roster, assignments] = await Promise.all([
      ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", args.guildId)).unique(),
      ctx.db.get(args.eventId),
      ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", args.guildId)).collect(),
      ctx.db.query("rosters").withIndex("eventId", (q) => q.eq("eventId", args.eventId)).unique(),
      ctx.db.query("userAssignments").withIndex("serverId", (q) => q.eq("serverId", args.guildId)).collect(),
    ]);

    if (!config || !event || event.guildId !== args.guildId) {
      return null;
    }

    return {
      config: normalizeConfigDoc(config),
      event: normalizeEventDoc(event),
      groups: groups.map(normalizeDoc),
      assignments: assignments.map((assignment) => ({
        userId: assignment.userId,
        primaryGroupId: assignment.primaryGroupId ? String(assignment.primaryGroupId) : undefined,
      })),
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
