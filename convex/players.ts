import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

import { getGuildByDiscordId, getUserByDiscordId, getUserDiscordId, getUserByIdentifier, getUserStableId } from "./identity";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

function assertInternalSecret(secret: string) {
  if (secret !== INTERNAL_AUTH_SECRET) {
    throw new Error("Unauthorized.");
  }
}

function normalizePlatformIds(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(
    values
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.replace(/\s+/g, "").trim())
      .filter(Boolean),
  )];
}

function buildPerformanceSummary(matches: Array<{
  kills: number;
  killDeathRatio: number;
  deaths: number;
  offense: number;
  defense: number;
  support: number;
}>) {
  const divisor = matches.length || 1;
  const totals = matches.reduce((acc, match) => ({
    kills: acc.kills + match.kills,
    killDeathRatio: acc.killDeathRatio + match.killDeathRatio,
    deaths: acc.deaths + match.deaths,
    offense: acc.offense + match.offense,
    defense: acc.defense + match.defense,
    support: acc.support + match.support,
  }), {
    kills: 0,
    killDeathRatio: 0,
    deaths: 0,
    offense: 0,
    defense: 0,
    support: 0,
  });

  return {
    matchesPlayed: matches.length,
    averages: {
      kills: totals.kills / divisor,
      killDeathRatio: totals.killDeathRatio / divisor,
      deaths: totals.deaths / divisor,
      offense: totals.offense / divisor,
      defense: totals.defense / divisor,
      support: totals.support / divisor,
    },
  };
}

function mergeUniqueStrings(primary: string[] | undefined, secondary: string[] | undefined) {
  return [...new Set([...(primary ?? []), ...(secondary ?? [])])];
}

function mergeScoreRecords(primary: Record<string, number> | undefined, secondary: Record<string, number> | undefined) {
  return {
    ...(secondary ?? {}),
    ...(primary ?? {}),
  };
}

function normalizeSearchText(value: string | undefined) {
  return value
    ?.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim() ?? "";
}

function getBestPlayerSearchScore(input: {
  query: string;
  name: string;
  discordId?: string;
  platformIds?: string[];
}) {
  const query = normalizeSearchText(input.query);
  if (!query) {
    return 1;
  }

  const candidates = [
    input.name,
    input.discordId,
    ...(input.platformIds ?? []),
  ].filter((value): value is string => Boolean(value?.trim()));

  let bestScore = 0;
  for (const rawCandidate of candidates) {
    const candidate = normalizeSearchText(rawCandidate);
    if (!candidate) {
      continue;
    }

    if (candidate === query) {
      bestScore = Math.max(bestScore, 1000);
      continue;
    }
    if (candidate.startsWith(query)) {
      bestScore = Math.max(bestScore, 800 - Math.min(candidate.length - query.length, 200));
      continue;
    }
    const index = candidate.indexOf(query);
    if (index >= 0) {
      bestScore = Math.max(bestScore, 600 - Math.min(index, 200));
      continue;
    }

    const queryTokens = query.split(/\s+/).filter(Boolean);
    if (queryTokens.length && queryTokens.every((token) => candidate.includes(token))) {
      bestScore = Math.max(bestScore, 400 - Math.min(candidate.length, 200));
    }
  }

  return bestScore;
}

function rewriteUserIdList(values: string[] | undefined, primaryUserId: string, secondaryUserId: string) {
  const rewritten = (values ?? []).map((value) => value === secondaryUserId ? primaryUserId : value);
  return [...new Set(rewritten)];
}

function rewriteOptionalUserId(value: string | undefined, primaryUserId: string, secondaryUserId: string) {
  return value === secondaryUserId ? primaryUserId : value;
}

function dedupeByUserId<T extends { userId: string }>(values: T[] | undefined, primaryUserId: string, secondaryUserId: string) {
  const result: T[] = [];
  const seen = new Set<string>();

  const primaryValues = (values ?? []).filter((value) => value.userId === primaryUserId);
  const secondaryValues = (values ?? []).filter((value) => value.userId !== primaryUserId);

  for (const value of [...primaryValues, ...secondaryValues]) {
    const rewrittenUserId = value.userId === secondaryUserId ? primaryUserId : value.userId;
    if (seen.has(rewrittenUserId)) {
      continue;
    }
    seen.add(rewrittenUserId);
    result.push({
      ...value,
      userId: rewrittenUserId,
    });
  }

  return result;
}

function rewriteRosterSquads(
  squads: Array<{
    name: string;
    group: string;
    order: number;
    color: string;
    icon?: string;
    players: Array<{
      id?: string;
      customName?: string;
      ack: boolean;
      confirmed?: boolean;
      note?: string;
      roleName?: string;
      roleIcon?: string;
    }>;
  }>,
  primaryUserId: string,
  secondaryUserId: string,
) {
  return squads.map((squad) => {
    const players = squad.players.map((player) => ({
      ...player,
      id: player.id === secondaryUserId ? primaryUserId : player.id,
    }));

    const dedupedPlayers: typeof players = [];
    const seen = new Set<string>();
    for (const player of players) {
      const key = player.id ? `user:${player.id}` : `custom:${player.customName ?? ""}:${player.roleName ?? ""}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      dedupedPlayers.push(player);
    }

    return {
      ...squad,
      players: dedupedPlayers,
    };
  });
}

async function rebuildUserPerformance(ctx: MutationCtx, userId: string) {
  const relatedStats = await ctx.db
    .query("playerStats")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();

  const matches = relatedStats.flatMap((doc) => Object.values(doc.matches));
  const performance = buildPerformanceSummary(matches);
  const user = await ctx.db
    .query("users")
    .withIndex("id", (q) => q.eq("id", userId))
    .unique()
    ?? await ctx.db
      .query("users")
      .withIndex("discordId", (q) => q.eq("discordId", userId))
      .unique();

  if (!user) {
    return;
  }

  await ctx.db.patch(user._id, {
    performance,
    updatedAt: new Date().toISOString(),
  });
}

async function mergePlayerStatsIntoUser(ctx: MutationCtx, input: {
  sourceUserId: string;
  targetUserId: string;
  now: string;
}) {
  const sourceStats = await ctx.db
    .query("playerStats")
    .withIndex("userId", (q) => q.eq("userId", input.sourceUserId))
    .collect();
  const targetStatsById = new Map(
    (await ctx.db.query("playerStats").withIndex("userId", (q) => q.eq("userId", input.targetUserId)).collect())
      .map((stat) => [stat.id, stat]),
  );

  for (const stat of sourceStats) {
    const rewrittenMatches = Object.fromEntries(
      Object.entries(stat.matches).map(([eventId, match]) => [
        eventId,
        {
          ...match,
          userId: input.targetUserId,
        },
      ]),
    );
    const existingTargetStat = targetStatsById.get(stat.id);

    if (existingTargetStat) {
      await ctx.db.patch(existingTargetStat._id, {
        latestName: existingTargetStat.latestName ?? stat.latestName,
        matches: {
          ...rewrittenMatches,
          ...existingTargetStat.matches,
        },
        updatedAt: input.now,
      });
      await ctx.db.delete(stat._id);
      continue;
    }

    await ctx.db.patch(stat._id, {
      userId: input.targetUserId,
      matches: rewrittenMatches,
      updatedAt: input.now,
    });
  }
}

function toPlayer(user: {
  _id: unknown;
  discordId?: string;
  id?: string;
  nicknames?: Record<string, string>;
  platformIds?: string[];
  name: string;
  avatar: string;
  managedGuildIds: string[];
  guildId?: string;
  mercenaryGuildIds: string[];
  isStreamer: boolean;
  score?: number;
  scores?: Record<string, number>;
  performance?: {
    matchesPlayed: number;
    averages: {
      kills: number;
      killDeathRatio: number;
      deaths: number;
      offense: number;
      defense: number;
      support: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}) {
  const legacyUser = user as typeof user & { steamId?: string; platformId?: string };
  return {
    ...user,
    id: getUserStableId(user),
    discordId: getUserDiscordId(user),
    linkedDiscordId: user.discordId,
    hasDiscordLink: Boolean(user.discordId),
    nicknames: user.nicknames ?? {},
    platformIds: normalizePlatformIds(user.platformIds ?? legacyUser.platformId ?? legacyUser.steamId),
    avatar: user.avatar || "https://cdn.discordapp.com/embed/avatars/0.png",
    scores: user.scores ?? {},
  };
}

export const getById = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserByIdentifier(ctx, args.userId);

    return user ? toPlayer(user) : null;
  },
});

export const searchClanPlayers = query({
  args: {
    guildId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 5, 25));
    const assignments = await ctx.db
      .query("userAssignments")
      .withIndex("serverId", (q) => q.eq("serverId", args.guildId))
      .collect();

    const seenUserIds = new Set<string>();
    const candidates: Array<ReturnType<typeof toPlayer> & {
      assignmentType?: "member" | "mercenary";
      assignmentStatus?: "pending" | "recruit" | "active";
      searchScore: number;
    }> = [];

    for (const assignment of assignments) {
      if (seenUserIds.has(assignment.userId)) {
        continue;
      }
      seenUserIds.add(assignment.userId);

      const user = await getUserByIdentifier(ctx, assignment.userId);
      if (!user) {
        continue;
      }

      const player = toPlayer(user);
      const searchScore = getBestPlayerSearchScore({
        query: args.query,
        name: player.name,
        discordId: player.discordId,
        platformIds: player.platformIds,
      });

      if (args.query.trim() && searchScore <= 0) {
        continue;
      }

      candidates.push({
        ...player,
        assignmentType: assignment.type,
        assignmentStatus: assignment.status,
        searchScore,
      });
    }

    candidates.sort((left, right) => (
      right.searchScore - left.searchScore
      || left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
      || left.discordId.localeCompare(right.discordId, undefined, { sensitivity: "base" })
    ));

    return candidates.slice(0, limit).map((player) => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      discordId: player.discordId,
      platformIds: player.platformIds,
      assignmentType: player.assignmentType,
      assignmentStatus: player.assignmentStatus,
      matchesPlayed: player.performance?.matchesPlayed ?? 0,
      averageKills: player.performance?.averages.kills ?? 0,
      averageKd: player.performance?.averages.killDeathRatio ?? 0,
      score: player.scores[args.guildId] ?? player.score ?? 0,
    }));
  },
});

export const getClanPlayerProfile = query({
  args: {
    guildId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const assignment = await ctx.db
      .query("userAssignments")
      .withIndex("serverId_userId", (q) => q.eq("serverId", args.guildId).eq("userId", args.userId))
      .unique();
    if (!assignment) {
      return null;
    }

    const user = await getUserByIdentifier(ctx, args.userId);
    if (!user) {
      return null;
    }

    const player = toPlayer(user);
    const statsDocs = await ctx.db
      .query("playerStats")
      .withIndex("userId", (q) => q.eq("userId", player.id))
      .collect();
    const allMatches = statsDocs.flatMap((doc) => Object.values(doc.matches));
    const sortedMatches = allMatches.sort((left, right) =>
      new Date(right.endedAt ?? right.importedAt).getTime() - new Date(left.endedAt ?? left.importedAt).getTime(),
    );
    const recentMatches = sortedMatches.slice(0, 5);
    const score = player.scores[args.guildId] ?? player.score ?? 0;

    return {
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      discordId: player.discordId,
      linkedDiscordId: player.linkedDiscordId,
      hasDiscordLink: player.hasDiscordLink,
      platformIds: player.platformIds,
      guildId: player.guildId,
      assignment: {
        type: assignment.type,
        status: assignment.status,
        membershipCategoryId: assignment.membershipCategoryId,
        paused: assignment.paused,
        pausedNote: assignment.pausedNote,
      },
      score,
      performance: player.performance ?? {
        matchesPlayed: 0,
        averages: {
          kills: 0,
          killDeathRatio: 0,
          deaths: 0,
          offense: 0,
          defense: 0,
          support: 0,
        },
      },
      recentMatches: recentMatches.map((match) => ({
        mapName: match.mapName,
        mapId: match.mapId,
        team: match.team,
        endedAt: match.endedAt,
        importedAt: match.importedAt,
        kills: match.kills,
        deaths: match.deaths,
        killDeathRatio: match.killDeathRatio,
        offense: match.offense,
        defense: match.defense,
        support: match.support,
        sourceUrl: match.sourceUrl,
      })),
      updatedAt: player.updatedAt,
      createdAt: player.createdAt,
    };
  },
});

export const syncDiscordProfile = mutation({
  args: {
    secret: v.string(),
    id: v.string(),
    name: v.string(),
    avatar: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const now = new Date().toISOString();
    const existing = await getUserByDiscordId(ctx, args.id);

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        avatar: args.avatar,
        updatedAt: now,
      });

      return getUserDiscordId(existing);
    }

    await ctx.db.insert("users", {
      discordId: args.id,
      id: args.id,
      name: args.name,
      nicknames: {},
      avatar: args.avatar,
      managedGuildIds: [],
      guildId: undefined,
      mercenaryGuildIds: [],
      isStreamer: false,
      score: 0,
      scores: {},
      performance: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return args.id;
  },
});

export const updatePlatformIds = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    platformIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const user = await getUserByIdentifier(ctx, args.userId);
    if (!user) {
      throw new Error("Player not found.");
    }

    const normalizedPlatformIds = normalizePlatformIds(args.platformIds);
    const allUsers = await ctx.db.query("users").collect();
    for (const candidate of allUsers) {
      if (candidate._id === user._id) {
        continue;
      }

      const legacyCandidate = candidate as typeof candidate & { steamId?: string; platformId?: string };
      const candidatePlatformIds = normalizePlatformIds(
        candidate.platformIds ?? legacyCandidate.platformId ?? legacyCandidate.steamId,
      );

      if (normalizedPlatformIds.some((platformId) => candidatePlatformIds.includes(platformId))) {
        throw new Error("One of these platform IDs is already linked to another player.");
      }
    }

    await ctx.db.patch(user._id, {
      platformIds: normalizedPlatformIds,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const setPrimaryGuild = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const [user, guild] = await Promise.all([
      getUserByDiscordId(ctx, args.userId),
      getGuildByDiscordId(ctx, args.guildId),
    ]);

    if (!user || !guild) {
      return null;
    }

    await ctx.db.patch(user._id, {
      guildId: args.guildId,
      mercenaryGuildIds: user.mercenaryGuildIds.filter((guildId) => guildId !== args.guildId),
      updatedAt: new Date().toISOString(),
    });

    return args.guildId;
  },
});

export const clearPlatformIds = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const user = await getUserByIdentifier(ctx, args.userId);
    if (!user) {
      throw new Error("Player not found.");
    }

    await ctx.db.patch(user._id, {
      platformIds: [],
      updatedAt: new Date().toISOString(),
    });
  },
});

export const updateProfile = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    avatar: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const user = await getUserByIdentifier(ctx, args.userId);
    if (!user) {
      throw new Error("Player not found.");
    }

    await ctx.db.patch(user._id, {
      avatar: args.avatar.trim(),
      updatedAt: new Date().toISOString(),
    });
  },
});

export const updateScore = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    guildId: v.string(),
    score: v.number(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    if (!Number.isInteger(args.score)) {
      throw new Error("Score must be an integer.");
    }

    const user = await getUserByIdentifier(ctx, args.userId);
    if (!user) {
      throw new Error("Player not found.");
    }

    const scores = {
      ...(user.scores ?? {}),
      [args.guildId]: args.score,
    };

    await ctx.db.patch(user._id, {
      score: args.score,
      scores,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const upsertImportedProfile = mutation({
  args: {
    secret: v.string(),
    id: v.string(),
    name: v.string(),
    platformId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const now = new Date().toISOString();
    const normalizedPlatformIds = normalizePlatformIds([args.platformId]);
    const existing = await getUserByIdentifier(ctx, args.id);
    const avatar = existing?.avatar || "https://cdn.discordapp.com/embed/avatars/0.png";

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name.trim(),
        avatar,
        platformIds: [...new Set([
          ...normalizePlatformIds(existing.platformIds),
          ...normalizedPlatformIds,
        ])],
        updatedAt: now,
      });
      return { userId: getUserStableId(existing), action: "updated" as const };
    }

    await ctx.db.insert("users", {
      id: args.id,
      discordId: undefined,
      name: args.name.trim(),
      nicknames: {},
      avatar,
      platformIds: normalizedPlatformIds,
      managedGuildIds: [],
      guildId: undefined,
      mercenaryGuildIds: [],
      isStreamer: false,
      score: 0,
      scores: {},
      performance: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return { userId: args.id, action: "created" as const };
  },
});

export const linkDiscordPlatformId = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    userName: v.string(),
    userAvatar: v.string(),
    platformId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const now = new Date().toISOString();
    const normalizedPlatformIds = normalizePlatformIds([args.platformId]);
    if (!normalizedPlatformIds.length) {
      throw new Error("Platform ID is required.");
    }

    const existing = await getUserByDiscordId(ctx, args.userId);
    const allUsers = await ctx.db.query("users").collect();
    for (const candidate of allUsers) {
      const candidateDiscordId = getUserDiscordId(candidate);
      if (existing ? candidate._id === existing._id : candidateDiscordId === args.userId) {
        continue;
      }

      const legacyCandidate = candidate as typeof candidate & { steamId?: string; platformId?: string };
      const candidatePlatformIds = normalizePlatformIds(
        candidate.platformIds ?? legacyCandidate.platformId ?? legacyCandidate.steamId,
      );

      if (normalizedPlatformIds.some((platformId) => candidatePlatformIds.includes(platformId))) {
        throw new Error("This platform ID is already linked to another player.");
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.userName.trim() || existing.name,
        avatar: args.userAvatar || existing.avatar,
        platformIds: [...new Set([
          ...normalizePlatformIds(existing.platformIds),
          ...normalizedPlatformIds,
        ])],
        updatedAt: now,
      });
      return { action: "updated" as const, platformId: normalizedPlatformIds[0] };
    }

    await ctx.db.insert("users", {
      id: args.userId,
      discordId: args.userId,
      name: args.userName.trim(),
      nicknames: {},
      avatar: args.userAvatar,
      platformIds: normalizedPlatformIds,
      managedGuildIds: [],
      guildId: undefined,
      mercenaryGuildIds: [],
      isStreamer: false,
      score: 0,
      scores: {},
      performance: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return { action: "created" as const, platformId: normalizedPlatformIds[0] };
  },
});

export const unlinkDiscordPlatformId = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    platformId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const user = await getUserByDiscordId(ctx, args.userId);
    if (!user) {
      throw new Error("Player not found.");
    }

    const target = normalizePlatformIds([args.platformId])[0];
    if (!target) {
      throw new Error("Platform ID is required.");
    }

    const nextPlatformIds = normalizePlatformIds(user.platformIds).filter((platformId) => platformId !== target);
    await ctx.db.patch(user._id, {
      platformIds: nextPlatformIds,
      updatedAt: new Date().toISOString(),
    });

    return { platformIds: nextPlatformIds };
  },
});

export const getDiscordPlatformLinkState = query({
  args: {
    secret: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const user = await getUserByDiscordId(ctx, args.userId);
    if (!user) {
      return null;
    }

    return {
      id: getUserStableId(user),
      platformIds: normalizePlatformIds(user.platformIds),
      name: user.name,
    };
  },
});

export const linkImportedDiscordProfile = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    discordId: v.string(),
    name: v.string(),
    avatar: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const now = new Date().toISOString();
    const importedUser = await getUserByIdentifier(ctx, args.userId);
    if (!importedUser) {
      throw new Error("Player not found.");
    }

    const existingDiscordUser = await getUserByDiscordId(ctx, args.discordId);
    const mergedPlatformIds = [...new Set([
      ...normalizePlatformIds(importedUser.platformIds),
      ...normalizePlatformIds(existingDiscordUser?.platformIds),
    ])];

    if (existingDiscordUser && existingDiscordUser._id !== importedUser._id) {
      await ctx.db.patch(existingDiscordUser._id, {
        name: args.name.trim(),
        avatar: args.avatar.trim() || existingDiscordUser.avatar,
        nicknames: {
          ...(existingDiscordUser.nicknames ?? {}),
          ...(importedUser.nicknames ?? {}),
        },
        platformIds: mergedPlatformIds,
        updatedAt: now,
      });

      await mergePlayerStatsIntoUser(ctx as never, {
        sourceUserId: getUserStableId(importedUser),
        targetUserId: getUserStableId(existingDiscordUser),
        now,
      });

      const relatedStats = await ctx.db
        .query("playerStats")
        .withIndex("userId", (q) => q.eq("userId", getUserStableId(existingDiscordUser)))
        .collect();

      await ctx.db.patch(existingDiscordUser._id, {
        performance: buildPerformanceSummary(relatedStats.flatMap((doc) => Object.values(doc.matches))),
        updatedAt: now,
      });

      await ctx.db.delete(importedUser._id);

      return { userId: getUserStableId(existingDiscordUser), merged: true };
    }

    await ctx.db.patch(importedUser._id, {
      discordId: args.discordId,
      name: args.name.trim(),
      avatar: args.avatar.trim() || importedUser.avatar,
      nicknames: importedUser.nicknames ?? {},
      platformIds: mergedPlatformIds,
      updatedAt: now,
    });

    return { userId: getUserStableId(importedUser), merged: false };
  },
});

export const mergeUsers = mutation({
  args: {
    secret: v.string(),
    primaryUserId: v.string(),
    secondaryUserId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    if (args.primaryUserId === args.secondaryUserId) {
      throw new Error("Pick two different users.");
    }

    const now = new Date().toISOString();
    const primaryUser = await getUserByIdentifier(ctx, args.primaryUserId);
    const secondaryUser = await getUserByIdentifier(ctx, args.secondaryUserId);

    if (!primaryUser || !secondaryUser) {
      throw new Error("User not found.");
    }

    const primaryStableId = getUserStableId(primaryUser);
    const secondaryStableId = getUserStableId(secondaryUser);

    const mergedPlatformIds = mergeUniqueStrings(
      normalizePlatformIds(primaryUser.platformIds),
      normalizePlatformIds(secondaryUser.platformIds),
    );

    const mergedNicknames = {
      ...(secondaryUser.nicknames ?? {}),
      ...(primaryUser.nicknames ?? {}),
    };

    const mergedManagedGuildIds = mergeUniqueStrings(primaryUser.managedGuildIds, secondaryUser.managedGuildIds);
    const mergedMercenaryGuildIds = mergeUniqueStrings(primaryUser.mercenaryGuildIds, secondaryUser.mercenaryGuildIds)
      .filter((guildId) => guildId !== (primaryUser.guildId ?? secondaryUser.guildId));
    const mergedScores = mergeScoreRecords(primaryUser.scores, secondaryUser.scores);

    await ctx.db.patch(primaryUser._id, {
      discordId: primaryUser.discordId ?? secondaryUser.discordId,
      id: primaryUser.id ?? secondaryUser.id,
      name: primaryUser.name || secondaryUser.name,
      avatar: primaryUser.avatar || secondaryUser.avatar,
      nicknames: mergedNicknames,
      platformIds: mergedPlatformIds,
      managedGuildIds: mergedManagedGuildIds,
      guildId: primaryUser.guildId ?? secondaryUser.guildId,
      mercenaryGuildIds: mergedMercenaryGuildIds,
      isStreamer: primaryUser.isStreamer || secondaryUser.isStreamer,
      score: primaryUser.score ?? secondaryUser.score ?? 0,
      scores: mergedScores,
      updatedAt: now,
    });

    const secondaryAssignments = await ctx.db
      .query("userAssignments")
      .withIndex("userId", (q) => q.eq("userId", secondaryStableId))
      .collect();
    const primaryAssignments = await ctx.db
      .query("userAssignments")
      .withIndex("userId", (q) => q.eq("userId", primaryStableId))
      .collect();
    const primaryAssignmentByServerId = new Map(primaryAssignments.map((assignment) => [assignment.serverId, assignment]));
    const affectedServerIds = new Set<string>();

    for (const assignment of secondaryAssignments) {
      affectedServerIds.add(assignment.serverId);
      const existingPrimaryAssignment = primaryAssignmentByServerId.get(assignment.serverId);
      if (existingPrimaryAssignment) {
        await ctx.db.patch(existingPrimaryAssignment._id, {
          type: existingPrimaryAssignment.type ?? assignment.type,
          status: existingPrimaryAssignment.status ?? assignment.status,
          membershipCategoryId: existingPrimaryAssignment.membershipCategoryId ?? assignment.membershipCategoryId,
          primaryGroupId: existingPrimaryAssignment.primaryGroupId ?? assignment.primaryGroupId,
          secondaryGroupIds: [...new Set([
            ...(existingPrimaryAssignment.secondaryGroupIds ?? []).map(String),
            ...(assignment.secondaryGroupIds ?? []).map(String),
          ])] as Id<"groups">[],
          paused: existingPrimaryAssignment.paused,
          pausedNote: existingPrimaryAssignment.pausedNote ?? assignment.pausedNote,
          updatedAt: now,
        });
        await ctx.db.delete(assignment._id);
      } else {
        await ctx.db.patch(assignment._id, {
          userId: primaryStableId,
          updatedAt: now,
        });
      }
    }

    const secondaryStats = await ctx.db
      .query("playerStats")
      .withIndex("userId", (q) => q.eq("userId", secondaryStableId))
      .collect();
    if (secondaryStats.length > 0) {
      await mergePlayerStatsIntoUser(ctx as never, {
        sourceUserId: secondaryStableId,
        targetUserId: primaryStableId,
        now,
      });
    }

    const events = await ctx.db.query("events").collect();
    const touchedEventIds = new Set<string>();
    for (const event of events) {
      const nextParticipants = dedupeByUserId(event.participants, primaryStableId, secondaryStableId);
      const nextSignUps = dedupeByUserId(event.signUps, primaryStableId, secondaryStableId);
      const nextAbsenceNotices = dedupeByUserId(event.absenceNotices, primaryStableId, secondaryStableId);
      const nextAttendanceReminderLog = dedupeByUserId(event.attendanceReminderLog, primaryStableId, secondaryStableId);

      const changed =
        JSON.stringify(nextParticipants) !== JSON.stringify(event.participants ?? []) ||
        JSON.stringify(nextSignUps) !== JSON.stringify(event.signUps ?? []) ||
        JSON.stringify(nextAbsenceNotices) !== JSON.stringify(event.absenceNotices ?? []) ||
        JSON.stringify(nextAttendanceReminderLog) !== JSON.stringify(event.attendanceReminderLog ?? []);

      if (changed) {
        await ctx.db.patch(event._id, {
          participants: nextParticipants,
          signUps: nextSignUps,
          absenceNotices: nextAbsenceNotices,
          attendanceReminderLog: nextAttendanceReminderLog,
          updatedAt: now,
        });
        touchedEventIds.add(String(event._id));
      }
    }

    const rosters = await ctx.db.query("rosters").collect();
    const touchedRosterIds = new Set<string>();
    for (const roster of rosters) {
      const nextSquads = rewriteRosterSquads(roster.squads, primaryStableId, secondaryStableId);
      const nextReservePlayerIds = rewriteUserIdList(roster.reservePlayerIds, primaryStableId, secondaryStableId);
      const nextNotAttendingPlayerIds = rewriteUserIdList(roster.notAttendingPlayerIds, primaryStableId, secondaryStableId);
      const nextReserveAttendances = dedupeByUserId(roster.reserveAttendances, primaryStableId, secondaryStableId);
      const nextStreamerId = rewriteOptionalUserId(roster.streamerId, primaryStableId, secondaryStableId);

      const changed =
        JSON.stringify(nextSquads) !== JSON.stringify(roster.squads) ||
        JSON.stringify(nextReservePlayerIds) !== JSON.stringify(roster.reservePlayerIds) ||
        JSON.stringify(nextNotAttendingPlayerIds) !== JSON.stringify(roster.notAttendingPlayerIds) ||
        JSON.stringify(nextReserveAttendances) !== JSON.stringify(roster.reserveAttendances ?? []) ||
        nextStreamerId !== roster.streamerId;

      if (changed) {
        await ctx.db.patch(roster._id, {
          squads: nextSquads,
          reservePlayerIds: nextReservePlayerIds,
          notAttendingPlayerIds: nextNotAttendingPlayerIds,
          reserveAttendances: nextReserveAttendances,
          streamerId: nextStreamerId,
          updatedAt: now,
        });
        touchedRosterIds.add(String(roster._id));
      }
    }

    for (const stratmap of await ctx.db.query("stratmaps").collect()) {
      if (stratmap.createdBy === secondaryStableId) {
        await ctx.db.patch(stratmap._id, {
          createdBy: primaryStableId,
          updatedAt: now,
        });
      }
    }

    for (const thread of await ctx.db.query("ticketThreads").collect()) {
      const creatorId = rewriteOptionalUserId(thread.creatorId, primaryStableId, secondaryStableId) ?? thread.creatorId;
      const closedByUserId = rewriteOptionalUserId(thread.closedByUserId, primaryStableId, secondaryStableId);
      if (creatorId !== thread.creatorId || closedByUserId !== thread.closedByUserId) {
        await ctx.db.patch(thread._id, {
          creatorId,
          closedByUserId,
          updatedAt: now,
        });
      }
    }

    for (const thread of await ctx.db.query("membershipApplicationThreads").collect()) {
      const creatorId = rewriteOptionalUserId(thread.creatorId, primaryStableId, secondaryStableId) ?? thread.creatorId;
      const closedByUserId = rewriteOptionalUserId(thread.closedByUserId, primaryStableId, secondaryStableId);
      if (creatorId !== thread.creatorId || closedByUserId !== thread.closedByUserId) {
        await ctx.db.patch(thread._id, {
          creatorId,
          closedByUserId,
          updatedAt: now,
        });
      }
    }

    for (const token of await ctx.db.query("platformIdLinkTokens").withIndex("userId", (q) => q.eq("userId", secondaryStableId)).collect()) {
      await ctx.db.patch(token._id, {
        userId: primaryStableId,
        updatedAt: now,
      });
    }

    await rebuildUserPerformance(ctx as never, primaryStableId);
    await ctx.db.delete(secondaryUser._id);

    return {
      primaryUserId: primaryStableId,
      secondaryUserId: secondaryStableId,
      affectedServerIds: [...affectedServerIds],
      touchedEventIds: [...touchedEventIds],
      touchedRosterIds: [...touchedRosterIds],
    };
  },
});
