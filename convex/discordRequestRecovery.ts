import { assertInternalSecret } from "./discord_shared"
import { pruneDeliveryPlans } from "./discordDelivery"
import { mutation } from "./_generated/server"
import { v } from "convex/values"

const kind = v.union(
    v.literal("reminder"),
    v.literal("roster"),
    v.literal("dispatch")
)
const tables = ["eventReminderRequests", "rosterChangeRequests"] as const

/** An active owner extends its lease; an expired/recovered owner cannot revive it. */
export const heartbeat = mutation({
    args: {
        secret: v.string(),
        kind,
        requestId: v.string(),
        claimToken: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const table =
            args.kind === "reminder"
                ? tables[0]
                : args.kind === "roster"
                  ? tables[1]
                  : "discordScheduledDispatches"
        const id = ctx.db.normalizeId(table, args.requestId)
        const row = id ? await ctx.db.get(id) : null
        if (
            !row ||
            row.status !== "processing" ||
            row.claimToken !== args.claimToken ||
            (row.leaseUntil ?? 0) <= Date.now()
        )
            return false
        await ctx.db.patch(row._id, { leaseUntil: Date.now() + 5 * 60_000 })
        return true
    },
})

/**
 * Never replay an interrupted external send without evidence: Discord may have
 * accepted it before the process died. Surface an unsuccessful, uncertain run
 * instead of leaving it processing forever or silently duplicating its DMs.
 * Indexed bounded batches run periodically, including when no watch row changes.
 */
export const expire = mutation({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const now = Date.now()
        let recovered = 0
        for (const table of tables) {
            const [legacy, expired] = await Promise.all([
                ctx.db
                    .query(table)
                    .withIndex("status_leaseUntil", (q) =>
                        q.eq("status", "processing").eq("leaseUntil", undefined)
                    )
                    .take(50),
                ctx.db
                    .query(table)
                    .withIndex("status_leaseUntil", (q) =>
                        q
                            .eq("status", "processing")
                            .gt("leaseUntil", 0)
                            .lte("leaseUntil", now)
                    )
                    .take(50),
            ])
            const rows = [...legacy, ...expired]
            for (const row of rows) {
                // Legacy claims have no lease. Give their existing claim window
                // time to finish during a controlled, old-worker-first rollout.
                const until =
                    row.leaseUntil ??
                    Date.parse(row.claimedAt ?? "") + 5 * 60_000
                if (Number.isFinite(until) && until > now) continue
                await ctx.db.patch(row._id, {
                    status: row.resumable ? "pending" : "failed",
                    completedAt: row.resumable
                        ? undefined
                        : new Date(now).toISOString(),
                    claimToken: undefined,
                    leaseUntil: undefined,
                    retryAt: row.resumable ? now : undefined,
                    error: row.resumable ? undefined : "delivery_uncertain",
                })
                recovered++
            }
        }
        await pruneDeliveryPlans(ctx)
        return { recovered }
    },
})
