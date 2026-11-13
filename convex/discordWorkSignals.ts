import { assertInternalSecret } from "./discord_shared"
import { query } from "./_generated/server"
import { v } from "convex/values"

/** Reactive queue heads only. Time advances in the worker's timer, not in a query. */
export const next = query({
    args: {
        secret: v.string(),
        kind: v.union(
            v.literal("dispatch"),
            v.literal("deletion"),
            v.literal("recap"),
            v.literal("membership-workflow"),
            v.literal("membership-effect"),
            v.literal("team")
        ),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        let heads: Array<{ key: string; dueAt: number } | null>
        if (args.kind === "dispatch") {
            const [pending, processing] = await Promise.all([
                ctx.db
                    .query("discordScheduledDispatches")
                    .withIndex("status_retryAt", (q) =>
                        q.eq("status", "pending")
                    )
                    .first(),
                ctx.db
                    .query("discordScheduledDispatches")
                    .withIndex("status_leaseUntil", (q) =>
                        q.eq("status", "processing")
                    )
                    .first(),
            ])
            heads = [
                pending
                    ? {
                          key: `${pending._id}:pending:${pending.attempts}`,
                          dueAt: pending.retryAt,
                      }
                    : null,
                processing
                    ? {
                          key: `${processing._id}:processing:${processing.claimToken}`,
                          dueAt: processing.leaseUntil ?? 0,
                      }
                    : null,
            ]
        } else if (args.kind === "deletion") {
            heads = await Promise.all(
                (["pending", "processing"] as const).map(async (status) => {
                    const row = await ctx.db
                        .query("eventDeletionRequests")
                        .withIndex("status_nextAttemptAt", (q) =>
                            q.eq("status", status)
                        )
                        .first()
                    return row
                        ? {
                              key: `${row._id}:${status}:${row.attempts}`,
                              dueAt: Date.parse(row.nextAttemptAt),
                          }
                        : null
                })
            )
        } else if (args.kind === "membership-workflow") {
            heads = await Promise.all(
                (["pending", "review"] as const).map(async (state) => {
                    const row = await ctx.db
                        .query("discordMembershipOperations")
                        .withIndex("state_workDueAt", (q) =>
                            q.eq("state", state)
                        )
                        .first()
                    return row
                        ? {
                              key: `${row._id}:${state}:${row.workToken ?? ""}:${row.workAttempts ?? 0}`,
                              dueAt: row.workDueAt ?? 0,
                          }
                        : null
                })
            )
            const completed = await ctx.db
                .query("discordMembershipOperations")
                .withIndex("state_updatedAt", (q) => q.eq("state", "complete"))
                .first()
            if (completed)
                heads.push({
                    key: `${completed._id}:retention:${completed.updatedAt}`,
                    dueAt: completed.updatedAt + 90 * 86400_000 + 1,
                })
        } else if (args.kind === "membership-effect") {
            const [expired, retry] = await Promise.all([
                ctx.db
                    .query("discordMembershipEffects")
                    .withIndex("state_leaseUntil", (q) =>
                        q.eq("state", "started")
                    )
                    .first(),
                ctx.db
                    .query("discordMembershipEffects")
                    .withIndex("repairable_state_retryAt", (q) =>
                        q.eq("repairable", true).eq("state", "retry")
                    )
                    .first(),
            ])
            heads = [
                expired
                    ? {
                          key: `${expired._id}:started:${expired.token}`,
                          dueAt: expired.leaseUntil,
                      }
                    : null,
                retry
                    ? {
                          key: `${retry._id}:retry:${retry.attempts}`,
                          dueAt: retry.retryAt,
                      }
                    : null,
            ]
        } else if (args.kind === "team") {
            const row = await ctx.db
                .query("teamRequests")
                .withIndex(
                    "notificationStatus_notificationNextAttemptAt",
                    (q) => q.eq("notificationStatus", "pending")
                )
                .first()
            heads = [
                row
                    ? {
                          key: `${row._id}:${row.notificationAttempts}:${row.notificationDeliveryState ?? "legacy"}`,
                          dueAt: row.notificationNextAttemptAt ?? 0,
                      }
                    : null,
            ]
        } else {
            heads = await Promise.all(
                (["ready", "claimed", "started"] as const).map(
                    async (state) => {
                        const row = await ctx.db
                            .query("matchRecaps")
                            .withIndex("deliveryState_deliveryDueAt", (q) =>
                                q.eq("deliveryState", state)
                            )
                            .first()
                        return row
                            ? {
                                  key: `${row._id}:${state}:${row.deliveryToken ?? ""}`,
                                  dueAt: row.deliveryDueAt ?? 0,
                              }
                            : null
                    }
                )
            )
        }
        return (
            heads
                .filter(
                    (head): head is { key: string; dueAt: number } =>
                        head !== null
                )
                .sort(
                    (a, b) => a.dueAt - b.dueAt || a.key.localeCompare(b.key)
                )[0] ?? null
        )
    },
})
