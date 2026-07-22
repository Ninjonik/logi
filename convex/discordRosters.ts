import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserByDiscordId } from "./identity";
import { assertInternalSecret, normalizeConfigDoc, normalizeDoc, normalizeEventDoc, normalizeUserDoc } from "./discord_shared";

export const getRosterImageContext = query({
  args: { secret: v.string(), eventId: v.id("events") },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const event = await ctx.db.get(args.eventId);
    if (!event) return null;
    const [roster, groups, assignments, config] = await Promise.all([
      ctx.db.query("rosters").withIndex("eventId", (q) => q.eq("eventId", args.eventId)).unique(),
      ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", event.guildId)).collect(),
      ctx.db.query("userAssignments").withIndex("serverId", (q) => q.eq("serverId", event.guildId)).collect(),
      ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", event.guildId)).unique(),
    ]);
    if (!roster?.published) return null;
    const userIds = [...new Set([
      ...roster.reservePlayerIds,
      ...roster.notAttendingPlayerIds,
      ...roster.squads.flatMap((squad) => squad.players.map((player) => player.id).filter(Boolean) as string[]),
    ])];
    const usersRaw = await Promise.all(userIds.map((userId) => getUserByDiscordId(ctx, userId)));
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

export const confirmRosterAttendanceFromMeetingChannel = mutation({
  args: { secret: v.string(), guildId: v.string(), rosterId: v.id("rosters") },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const [config, roster] = await Promise.all([
      ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", args.guildId)).unique(),
      ctx.db.get(args.rosterId),
    ]);
    if (!config?.meetingChannelId) throw new Error("Meeting channel is not configured.");
    if (!roster) throw new Error("Roster not found.");
    const event = await ctx.db.get(roster.eventId);
    if (!event || event.guildId !== args.guildId) throw new Error("Roster does not belong to this server.");

    const memberAccess = await ctx.db.query("discordMemberAccess").withIndex("guildId", (q) => q.eq("guildId", args.guildId)).collect();
    const memberIdsInMeetingChannel = new Set(
      memberAccess.filter((member) => member.voiceChannelId === config.meetingChannelId).map((member) => member.userId),
    );

    let rosteredCount = 0;
    let reserveCount = 0;
    let updatedCount = 0;
    const updatedUserIds = new Set<string>();

    const squads = roster.squads.map((squad) => ({
      ...squad,
      players: squad.players.map((player) => {
        if (!player.id || !memberIdsInMeetingChannel.has(player.id)) return player;
        rosteredCount += 1;
        if (player.ack && player.confirmed) return player;
        updatedCount += 1;
        updatedUserIds.add(player.id);
        return { ...player, ack: true, confirmed: true };
      }),
    }));

    const reserveAttendances = (roster.reserveAttendances ?? []).map((entry) => {
      if (!memberIdsInMeetingChannel.has(entry.userId)) return entry;
      reserveCount += 1;
      if (entry.ack && entry.confirmed) return entry;
      updatedCount += 1;
      updatedUserIds.add(entry.userId);
      return { ...entry, ack: true, confirmed: true };
    });

    for (const userId of roster.reservePlayerIds) {
      if (!memberIdsInMeetingChannel.has(userId) || reserveAttendances.some((entry) => entry.userId === userId)) continue;
      reserveCount += 1;
      updatedCount += 1;
      updatedUserIds.add(userId);
      reserveAttendances.push({ userId, ack: true, confirmed: true });
    }

    if (updatedCount > 0) {
      await ctx.db.patch(roster._id, {
        squads,
        reserveAttendances,
        updatedAt: new Date().toISOString(),
      });
    }

    return {
      matchedVoiceCount: memberIdsInMeetingChannel.size,
      rosteredCount,
      reserveCount,
      updatedCount,
      updatedUserIds: Array.from(updatedUserIds),
    };
  },
});
