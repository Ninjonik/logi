import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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

      const importedStats = await ctx.db
        .query("playerStats")
        .withIndex("userId", (q) => q.eq("userId", getUserStableId(importedUser)))
        .collect();

      for (const stat of importedStats) {
        const matches = Object.fromEntries(
          Object.entries(stat.matches).map(([eventId, match]) => [
            eventId,
            {
              ...match,
              userId: getUserStableId(existingDiscordUser),
            },
          ]),
        );

        await ctx.db.patch(stat._id, {
          userId: getUserStableId(existingDiscordUser),
          matches,
          updatedAt: now,
        });
      }

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
