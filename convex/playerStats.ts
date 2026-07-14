import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

function assertInternalSecret(secret: string) {
  if (secret !== INTERNAL_AUTH_SECRET) {
    throw new Error("Unauthorized.");
  }
}

const playerMatchStats = v.object({
  sourceUrl: v.string(),
  importedAt: v.string(),
  endedAt: v.optional(v.string()),
  mapId: v.string(),
  mapName: v.optional(v.string()),
  playerName: v.string(),
  userId: v.optional(v.string()),
  team: v.union(v.literal("axis"), v.literal("allies"), v.literal("unknown")),
  kills: v.number(),
  killDeathRatio: v.number(),
  deaths: v.number(),
  offense: v.number(),
  defense: v.number(),
  support: v.number(),
});

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

function normalizeDoc<T extends { _id: unknown }>(doc: T) {
  return {
    ...doc,
    id: String(doc._id),
  };
}

export const upsertMatches = mutation({
  args: {
    secret: v.string(),
    entries: v.array(v.object({
      id: v.string(),
      userId: v.optional(v.string()),
      latestName: v.string(),
      eventId: v.string(),
      match: playerMatchStats,
    })),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const affectedUserIds = new Set<string>();

    for (const entry of args.entries) {
      const existing = await ctx.db
        .query("playerStats")
        .withIndex("id", (q) => q.eq("id", entry.id))
        .unique();

      const matches = {
        ...(existing?.matches ?? {}),
        [entry.eventId]: entry.match,
      };
      const updatedAt = new Date().toISOString();

      if (existing) {
        await ctx.db.patch(existing._id, {
          userId: entry.userId ?? existing.userId,
          latestName: entry.latestName,
          matches,
          updatedAt,
        });
        if (entry.userId ?? existing.userId) {
          affectedUserIds.add((entry.userId ?? existing.userId)!);
        }
        continue;
      }

      await ctx.db.insert("playerStats", {
        id: entry.id,
        userId: entry.userId,
        latestName: entry.latestName,
        matches,
        updatedAt,
      });
      if (entry.userId) {
        affectedUserIds.add(entry.userId);
      }
    }

    for (const userId of affectedUserIds) {
      const relatedStats = await ctx.db
        .query("playerStats")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect();

      const matches = relatedStats.flatMap((doc) => Object.values(doc.matches));
      const performance = buildPerformanceSummary(matches);
      const user = await ctx.db
        .query("users")
        .withIndex("id", (q) => q.eq("id", userId))
        .unique();

      if (!user) {
        continue;
      }

      await ctx.db.patch(user._id, {
        performance,
        updatedAt: new Date().toISOString(),
      });
    }

    return { ok: true, count: args.entries.length };
  },
});

export const listForUser = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("playerStats")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();

    return docs.map(normalizeDoc);
  },
});
