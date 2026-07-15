import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { getUserByDiscordId, getUserDiscordId } from "./identity";

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

function toPlayer(user: {
  _id: unknown;
  discordId?: string;
  id?: string;
  platformIds?: string[];
  name: string;
  avatar: string;
  managedGuildIds: string[];
  guildId?: string;
  mercenaryGuildIds: string[];
  isStreamer: boolean;
  score: number;
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
    id: String(user._id),
    discordId: getUserDiscordId(user),
    platformIds: normalizePlatformIds(user.platformIds ?? legacyUser.platformId ?? legacyUser.steamId),
    avatar: user.avatar || "https://cdn.discordapp.com/embed/avatars/0.png",
  };
}

export const getById = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserByDiscordId(ctx, args.userId);

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
      avatar: args.avatar,
      managedGuildIds: [],
      guildId: undefined,
      mercenaryGuildIds: [],
      isStreamer: false,
      score: 0,
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

    const user = await getUserByDiscordId(ctx, args.userId);
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

export const clearPlatformIds = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const user = await getUserByDiscordId(ctx, args.userId);
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

    const user = await getUserByDiscordId(ctx, args.userId);
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
    score: v.number(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    if (!Number.isInteger(args.score)) {
      throw new Error("Score must be an integer.");
    }

    const user = await getUserByDiscordId(ctx, args.userId);
    if (!user) {
      throw new Error("Player not found.");
    }

    await ctx.db.patch(user._id, {
      score: args.score,
      updatedAt: new Date().toISOString(),
    });
  },
});
