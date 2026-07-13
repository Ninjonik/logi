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
        continue;
      }

      await ctx.db.insert("playerStats", {
        id: entry.id,
        userId: entry.userId,
        latestName: entry.latestName,
        matches,
        updatedAt,
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
