import { query } from "./_generated/server";
import { v } from "convex/values";
import { getGuildDiscordId, getUserByDiscordId } from "./identity";
import {
  canAccessServerContext,
  canAdminServerContext,
  normalizeAssignmentDoc,
  normalizeDoc,
  normalizeEventDoc,
  normalizeGuildDoc,
  normalizeUserDoc,
} from "../src/infrastructure/convex/server-read-model";

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

    if (!canAccessServerContext({ user, serverDiscordId, discordAccess })) {
      return null;
    }

    const canAdmin = canAdminServerContext({
      serverAdminIds: server.adminIds,
      userId: args.userId,
      discordAccess,
    });
    const [events, topicPresets, squadPresets, groups, assignments, discordConfig] = await Promise.all([
      ctx.db.query("events").withIndex("guildId", (q) => q.eq("guildId", serverDiscordId)).collect(),
      ctx.db.query("topicPresets").withIndex("guildId", (q) => q.eq("guildId", serverDiscordId)).collect(),
      ctx.db.query("squadPresets").withIndex("guildId", (q) => q.eq("guildId", serverDiscordId)).collect(),
      ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", serverDiscordId)).collect(),
      ctx.db.query("userAssignments").withIndex("serverId", (q) => q.eq("serverId", serverDiscordId)).collect(),
      ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", serverDiscordId)).unique(),
    ]);
    const eventRosters = await Promise.all(events.map((event) => ctx.db.query("rosters").withIndex("eventId", (q) => q.eq("eventId", event._id)).unique()));
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
