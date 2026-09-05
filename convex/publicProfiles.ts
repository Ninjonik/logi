import { paginationOptsValidator } from "convex/server";

import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import { getGuildByDiscordId, getGuildDiscordId, getUserByIdentifier, getUserStableId } from "./identity";

function sortedMatches(matches: Array<Record<string, unknown>>) {
  return [...matches].sort((left, right) =>
    new Date(String(right.endedAt ?? right.importedAt)).getTime() - new Date(String(left.endedAt ?? left.importedAt)).getTime(),
  );
}

/** Public, intentionally limited player data. Never add Discord IDs, notes,
 * platform identifiers, assignment details, or unpublished roster data here. */
export const getPlayer = query({
  args: { playerId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByIdentifier(ctx, args.playerId);
    if (!user) return null;

    const userId = getUserStableId(user);
    const statDocs = await ctx.db.query("playerStats").withIndex("userId", (q) => q.eq("userId", userId)).collect();
    const candidateMatches = statDocs.flatMap((doc) => Object.entries(doc.matches).map(([eventId, match]) => ({ eventId, ...match })));
    const matches = sortedMatches((await Promise.all(candidateMatches.map(async (match) => {
      const event = await ctx.db.get(match.eventId as Id<"events">);
      return event && event.kind !== "training" && event.matchStatsId ? match : null;
    }))).filter((match): match is NonNullable<typeof match> => Boolean(match)));
    if (!matches.length) return null;

    const assignments = await ctx.db.query("userAssignments").withIndex("userId", (q) => q.eq("userId", userId)).collect();
    const clans = (await Promise.all(assignments
      .filter((assignment) => assignment.status === "active")
      .map(async (assignment) => await getGuildByDiscordId(ctx, assignment.serverId))))
      .filter((guild): guild is NonNullable<typeof guild> => Boolean(guild))
      .map((guild) => ({ id: getGuildDiscordId(guild), name: guild.name, avatar: guild.avatar }));

    const recentMatches = await Promise.all(matches.slice(0, 30).map(async (match) => {
      const event = await ctx.db.get(match.eventId as Id<"events">);
      return {
        eventId: match.eventId,
        name: event?.name ?? "Match",
        endedAt: String(match.endedAt ?? event?.gameEnd ?? match.importedAt),
        mapName: typeof match.mapName === "string" ? match.mapName : undefined,
        kills: Number(match.kills ?? 0),
        deaths: Number(match.deaths ?? 0),
        killDeathRatio: Number(match.killDeathRatio ?? 0),
        offense: Number(match.offense ?? 0),
        defense: Number(match.defense ?? 0),
        support: Number(match.support ?? 0),
      };
    }));

    const totals = matches.reduce<{ kills: number; deaths: number }>((sum, match) => ({ kills: sum.kills + Number(match.kills ?? 0), deaths: sum.deaths + Number(match.deaths ?? 0) }), { kills: 0, deaths: 0 });
    return {
      id: userId,
      name: user.name,
      avatar: user.avatar,
      clans,
      stats: {
        matches: matches.length,
        kills: totals.kills,
        deaths: totals.deaths,
        kd: totals.deaths ? totals.kills / totals.deaths : totals.kills,
      },
      recentMatches,
      updatedAt: user.updatedAt,
    };
  },
});

export const getMatch = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const [event, match] = await Promise.all([
      ctx.db.get(args.eventId),
      ctx.db.query("matchStats").withIndex("eventId", (q) => q.eq("eventId", args.eventId)).unique(),
    ]);
    if (!event || !match || event.matchStatsId !== match._id) return null;
    return { ...match, id: String(match._id), eventId: String(event._id), eventName: event.name, thumbnailUrl: event.thumbnailUrl };
  },
});

export const getClan = query({
  args: { guildId: v.string() },
  handler: async (ctx, args) => {
    const guild = await getGuildByDiscordId(ctx, args.guildId);
    if (!guild) return null;
    const guildId = getGuildDiscordId(guild);
    const [assignments, events] = await Promise.all([
      ctx.db.query("userAssignments").withIndex("serverId", (q) => q.eq("serverId", guildId)).collect(),
      ctx.db.query("events").withIndex("guildId", (q) => q.eq("guildId", guildId)).collect(),
    ]);
    const activeMembers = assignments.filter((assignment) => assignment.status === "active");
    const memberCount = new Set([...activeMembers.map((assignment) => assignment.userId), ...guild.memberIds]).size;
    if (memberCount < 1) return null;
    const recordedEvents = events.filter((event) => event.kind !== "training" && event.matchStatsId);
    const recentMatches = (await Promise.all(recordedEvents.sort((left, right) => new Date(right.gameEnd).getTime() - new Date(left.gameEnd).getTime()).slice(0, 12).map(async (event) => {
      const match = await ctx.db.query("matchStats").withIndex("eventId", (q) => q.eq("eventId", event._id)).unique();
      const category = guild.eventCategories?.find((item) => item.id === event.matchType);
      return match ? { eventId: String(event._id), name: event.name, gameEnd: event.gameEnd, mapName: match.raw.map.pretty_name, score: match.raw.result, outcome: event.eventResult?.outcome, category: category?.label ?? event.matchType } : null;
    }))).filter((match): match is NonNullable<typeof match> => Boolean(match));
    const decidedMatches = recordedEvents.filter((event) => event.eventResult?.outcome === "victory" || event.eventResult?.outcome === "defeat");
    const wins = recordedEvents.filter((event) => event.eventResult?.outcome === "victory").length;
    return { id: guildId, name: guild.name, avatar: guild.avatar, description: guild.description, memberCount, stats: { matches: recordedEvents.length, wins, winRate: decidedMatches.length ? wins / decidedMatches.length : 0 }, recentMatches, updatedAt: guild.updatedAt };
  },
});

export const listClans = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    // Filter before paging: otherwise recently-created ghost competition teams
    // can fill an entire page and hide eligible real clans behind it.
    const guilds = (await ctx.db.query("guilds").collect()).sort((left, right) => right._creationTime - left._creationTime);
    const eligible = (await Promise.all(guilds.map(async (guild) => {
      const assignments = await ctx.db.query("userAssignments").withIndex("serverId", (q) => q.eq("serverId", getGuildDiscordId(guild))).collect();
      const memberCount = new Set([...assignments.filter((assignment) => assignment.status === "active").map((assignment) => assignment.userId), ...guild.memberIds]).size;
      return memberCount >= 1 ? { id: getGuildDiscordId(guild), name: guild.name, avatar: guild.avatar, description: guild.description, memberCount } : null;
    }))).filter((guild): guild is NonNullable<typeof guild> => Boolean(guild));
    const offset = args.paginationOpts.cursor ? Number(args.paginationOpts.cursor) : 0;
    const page = eligible.slice(offset, offset + args.paginationOpts.numItems);
    const nextOffset = offset + page.length;
    return { page, isDone: nextOffset >= eligible.length, continueCursor: nextOffset >= eligible.length ? "" : String(nextOffset) };
  },
});

/** Platform-wide public match history. A match is public only after the event
 * points at its imported result; this intentionally excludes planned and
 * partially imported matches. */
export const listMatches = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("matchStats").order("desc").paginate(args.paginationOpts);
    const guilds = new Map<string, Awaited<ReturnType<typeof getGuildByDiscordId>>>();
    const page = (await Promise.all(result.page.map(async (match) => {
      const event = await ctx.db.get(match.eventId);
      if (!event || event.kind === "training" || event.matchStatsId !== match._id) return null;
      let guild = guilds.get(match.guildId);
      if (guild === undefined) {
        guild = await getGuildByDiscordId(ctx, match.guildId);
        guilds.set(match.guildId, guild);
      }
      const category = guild?.eventCategories?.find((item) => item.id === event.matchType);
      return {
        eventId: String(event._id),
        name: event.name,
        gameEnd: event.gameEnd,
        clan: guild ? { id: getGuildDiscordId(guild), name: guild.name, avatar: guild.avatar } : null,
        mapName: match.raw.map.pretty_name,
        score: match.raw.result,
        outcome: event.eventResult?.outcome,
        category: category?.label ?? event.matchType,
      };
    }))).filter((match): match is NonNullable<typeof match> => Boolean(match));
    return { ...result, page };
  },
});

/** Finds only players with at least one result-backed public match. */
export const searchPlayers = query({
  args: { term: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const term = args.term.trim().toLocaleLowerCase();
    if (term.length < 2) return { page: [], isDone: true, continueCursor: "" };
    const result = await ctx.db.query("users").withSearchIndex("name", (q) => q.search("name", term)).paginate(args.paginationOpts);
    const page = (await Promise.all(result.page.map(async (user) => {
      const stats = await ctx.db.query("playerStats").withIndex("userId", (q) => q.eq("userId", getUserStableId(user))).collect();
      for (const entry of stats) {
        for (const eventId of Object.keys(entry.matches)) {
        const event = await ctx.db.get(eventId as Id<"events">);
          if (event && event.kind !== "training" && event.matchStatsId) return { id: getUserStableId(user), name: user.name, avatar: user.avatar };
        }
      }
      return null;
    }))).filter((user): user is NonNullable<typeof user> => Boolean(user));
    return { ...result, page };
  },
});
