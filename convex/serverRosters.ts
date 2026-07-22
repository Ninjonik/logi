import { query } from "./_generated/server";
import { v } from "convex/values";
import { getGuildDiscordId, getUserByDiscordId } from "./identity";
import {
  canAccessServerContext,
  canAdminServerContext,
  normalizeAssignmentDoc,
  normalizeDoc,
  normalizeEventDoc,
  normalizeUserDoc,
} from "../src/infrastructure/convex/server-read-model";

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

    if (!canAccessServerContext({ user, serverDiscordId, discordAccess })) {
      return null;
    }

    const canAdmin = canAdminServerContext({
      serverAdminIds: server.adminIds,
      userId: args.userId,
      discordAccess,
    });
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
