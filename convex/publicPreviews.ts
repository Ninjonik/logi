import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

/** The deliberately small, public-only source for link-preview metadata. */
export const get = query({
  args: { entityType: v.union(v.literal("player"), v.literal("clan"), v.literal("match")), entityId: v.string() },
  handler: async (ctx, args) => await ctx.db.query("publicPreviews").withIndex("entity", (q) => q.eq("entityType", args.entityType).eq("entityId", args.entityId)).unique(),
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
