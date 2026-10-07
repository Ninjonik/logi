import { internalMutation } from "./_generated/server"
import { makeFunctionReference } from "convex/server"

/**
 * Hourly housekeeping of the per-request API tables. Each table keeps a row
 * per website write (`apiIdempotencyKeys`, one per Idempotency-Key, with the
 * stored response) or per rate-limit window (`apiRateLimitBuckets`); nothing
 * else removes a row once it has expired, and production reached tens of
 * thousands of dead rows in each. Bounded batches through the expiry
 * indexes, rescheduled while a batch is full (ARCHITECTURE.md, "Convex hot
 * paths"). A small module of its own, so the cron evaluates no Zod.
 */
const BATCH = 250

export const pruneExpired = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now()
        const keys = await ctx.db
            .query("apiIdempotencyKeys")
            .withIndex("expiresAt", (q) => q.lte("expiresAt", now))
            .take(BATCH)
        for (const row of keys) await ctx.db.delete(row._id)
        const buckets = await ctx.db
            .query("apiRateLimitBuckets")
            .withIndex("resetAt", (q) => q.lte("resetAt", now))
            .take(BATCH)
        for (const row of buckets) await ctx.db.delete(row._id)
        const more = keys.length === BATCH || buckets.length === BATCH
        if (more)
            await ctx.scheduler.runAfter(
                0,
                makeFunctionReference<"mutation">(
                    "apiHousekeeping:pruneExpired"
                ),
                {}
            )
        return { keys: keys.length, buckets: buckets.length, more }
    },
})
