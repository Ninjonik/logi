import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/** The deliberately small, public-only source for link-preview metadata. */
export const get = query({
  args: { entityType: v.union(v.literal("player"), v.literal("clan"), v.literal("match")), entityId: v.string() },
  handler: async (ctx, args) => await ctx.db.query("publicPreviews").withIndex("entity", (q) => q.eq("entityType", args.entityType).eq("entityId", args.entityId)).unique(),
});

export const ensure = mutation({
  args: { entityType: v.union(v.literal("player"), v.literal("clan"), v.literal("match")), entityId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const existing = await ctx.db.query("publicPreviews").withIndex("entity", (q) => q.eq("entityType", args.entityType).eq("entityId", args.entityId)).unique();
    if (existing) { await ctx.db.patch(existing._id, { expiresAt, updatedAt: now }); return { ...existing, expiresAt, updatedAt: now }; }
    let title: string | null = null;
    let description: string | null = null;
    if (args.entityType === "match") {
      const event = await ctx.db.get(args.entityId as Id<"events">);
      const match = event ? await ctx.db.query("matchStats").withIndex("eventId", (q) => q.eq("eventId", event._id)).unique() : null;
      if (!event || !match || event.matchStatsId !== match._id) return null;
      const score = `${match.raw.result.allied} – ${match.raw.result.axis}`;
      title = `${event.name} · ${score}`; description = `${match.raw.map.pretty_name} · Recorded match result`;
    } else if (args.entityType === "player") {
      const user = await ctx.db.query("users").withIndex("id", (q) => q.eq("id", args.entityId)).unique() ?? await ctx.db.query("users").withIndex("discordId", (q) => q.eq("discordId", args.entityId)).unique();
      if (!user) return null;
      const stats = await ctx.db.query("playerStats").withIndex("userId", (q) => q.eq("userId", args.entityId)).collect();
      const matches = stats.flatMap((entry) => Object.values(entry.matches));
      if (!matches.length) return null;
      const kills = matches.reduce((sum, match) => sum + match.kills, 0); const deaths = matches.reduce((sum, match) => sum + match.deaths, 0);
      title = user.name; description = `${matches.length} recorded matches · ${(deaths ? kills / deaths : kills).toFixed(2)} K/D`;
    } else {
      const guild = await ctx.db.query("guilds").withIndex("discordId", (q) => q.eq("discordId", args.entityId)).unique() ?? await ctx.db.query("guilds").withIndex("id", (q) => q.eq("id", args.entityId)).unique();
      if (!guild) return null;
      title = guild.name; description = "Public clan profile and recorded match history.";
    }
    const preview = { entityType: args.entityType, entityId: args.entityId, title, description, imageVersion: now, updatedAt: now, expiresAt };
    const id = await ctx.db.insert("publicPreviews", preview);
    return { ...preview, _id: id };
  },
});

/** Runs from the Convex cron. The index keeps this bounded even as previews grow. */
export const removeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date().toISOString();
    const expired = await ctx.db.query("publicPreviews").withIndex("expiresAt", (q) => q.lt("expiresAt", now)).take(250);
    await Promise.all(expired.map((preview) => ctx.db.delete(preview._id)));
    return { removed: expired.length };
  },
});
