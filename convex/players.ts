import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

function assertInternalSecret(secret: string) {
  if (secret !== INTERNAL_AUTH_SECRET) {
    throw new Error("Unauthorized.");
  }
}

function toPlayer(user: {
  id: string;
  steamId?: string;
  name: string;
  avatar: string;
  managedGuildIds: string[];
  guildId?: string;
  mercenaryGuildIds: string[];
  isStreamer: boolean;
  score: number;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    ...user,
    avatar: user.avatar || "https://cdn.discordapp.com/embed/avatars/0.png",
  };
}

export const getById = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("id", (q) => q.eq("id", args.userId))
      .unique();

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
    const existing = await ctx.db
      .query("users")
      .withIndex("id", (q) => q.eq("id", args.id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        avatar: args.avatar,
        updatedAt: now,
      });

      return existing.id;
    }

    await ctx.db.insert("users", {
      id: args.id,
      name: args.name,
      avatar: args.avatar,
      managedGuildIds: [],
      guildId: undefined,
      mercenaryGuildIds: [],
      isStreamer: false,
      score: 0,
      createdAt: now,
      updatedAt: now,
    });

    return args.id;
  },
});

export const linkSteam = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    steamId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const user = await ctx.db
      .query("users")
      .withIndex("id", (q) => q.eq("id", args.userId))
      .unique();
    if (!user) {
      throw new Error("Player not found.");
    }

    const duplicateSteam = await ctx.db
      .query("users")
      .withIndex("steamId", (q) => q.eq("steamId", args.steamId))
      .unique();

    if (duplicateSteam && duplicateSteam._id !== user._id) {
      throw new Error("This Steam account is already linked to another player.");
    }

    await ctx.db.patch(user._id, {
      steamId: args.steamId,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const unlinkSteam = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const user = await ctx.db
      .query("users")
      .withIndex("id", (q) => q.eq("id", args.userId))
      .unique();
    if (!user) {
      throw new Error("Player not found.");
    }

    await ctx.db.patch(user._id, {
      steamId: undefined,
      updatedAt: new Date().toISOString(),
    });
  },
});
