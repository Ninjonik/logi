import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserByDiscordId } from "./identity";
import { assertInternalSecret, normalizeDoc } from "./discord-shared";

export const createPlatformIdLinkToken = mutation({
  args: {
    secret: v.string(),
    guildId: v.string(),
    categoryId: v.string(),
    userId: v.string(),
    userName: v.string(),
    userAvatar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    const token = crypto.randomUUID();
    const existingTokens = await ctx.db.query("platformIdLinkTokens").withIndex("userId", (q) => q.eq("userId", args.userId)).collect();
    await Promise.all(existingTokens.map((doc) => ctx.db.delete(doc._id)));
    await ctx.db.insert("platformIdLinkTokens", {
      token,
      guildId: args.guildId,
      userId: args.userId,
      userName: args.userName,
      userAvatar: args.userAvatar,
      categoryId: args.categoryId,
      expiresAt,
      consumedAt: undefined,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    return { token, expiresAt };
  },
});

export const getPlatformIdLinkToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db.query("platformIdLinkTokens").withIndex("token", (q) => q.eq("token", args.token)).unique();
    return doc ? normalizeDoc(doc) : null;
  },
});

export const consumePlatformIdLinkToken = mutation({
  args: { secret: v.string(), token: v.string(), platformId: v.string() },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const doc = await ctx.db.query("platformIdLinkTokens").withIndex("token", (q) => q.eq("token", args.token)).unique();
    if (!doc) throw new Error("Token not found.");
    if (doc.consumedAt) throw new Error("Token already used.");
    if (new Date(doc.expiresAt).getTime() < Date.now()) throw new Error("Token expired.");
    const existingUser = await getUserByDiscordId(ctx, doc.userId);
    const now = new Date().toISOString();
    const normalizedPlatformId = args.platformId.trim();
    if (!normalizedPlatformId) throw new Error("Platform ID is required.");

    if (existingUser) {
      const nextPlatformIds = [...new Set([...(existingUser.platformIds ?? []), normalizedPlatformId])];
      await ctx.db.patch(existingUser._id, {
        name: existingUser.name || doc.userName,
        avatar: existingUser.avatar || doc.userAvatar || "https://cdn.discordapp.com/embed/avatars/0.png",
        platformIds: nextPlatformIds,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("users", {
        discordId: doc.userId,
        id: doc.userId,
        name: doc.userName,
        platformIds: [normalizedPlatformId],
        avatar: doc.userAvatar || "https://cdn.discordapp.com/embed/avatars/0.png",
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
    }

    await ctx.db.patch(doc._id, { consumedAt: now, updatedAt: now });
    return { ok: true };
  },
});
