import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("id", (q) => q.eq("id", identity.subject!))
      .unique();
    if (!user) {
      return null;
    }

    return toPlayer(user);
  },
});

export const linkSteam = mutation({
  args: {
    steamId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      throw new Error("You must be signed in to link Steam.");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("id", (q) => q.eq("id", identity.subject!))
      .unique();
    if (!user) {
      throw new Error("Player not found.");
    }

    const duplicateSteam = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("steamId"), args.steamId))
      .first();

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
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      throw new Error("You must be signed in to unlink Steam.");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("id", (q) => q.eq("id", identity.subject!))
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

export const syncDiscordProfile = mutation({
  args: {
    name: v.string(),
    avatar: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      throw new Error("You must be signed in to sync your profile.");
    }

    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("users")
      .withIndex("id", (q) => q.eq("id", identity.subject!))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        avatar: args.avatar,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      id: identity.subject,
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
  },
});
