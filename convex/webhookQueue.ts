import {
    shouldRetryWebhookDelivery,
    webhookRetryDelayMs,
} from "../src/domain/webhooks/delivery-policy"
import { internalMutation, type MutationCtx } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

const dispatcher = makeFunctionReference<"action">(
    "webhookDispatcher:deliverDue"
)
const deliveryLease = 30_000
export async function wakeWebhookGuild(
    ctx: MutationCtx,
    guildId: string,
    at = Date.now()
) {
    const queue = await ctx.db
        .query("webhookDispatchGuilds")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
    if (!queue)
        await ctx.db.insert("webhookDispatchGuilds", { guildId, wakeAt: at })
    else if (queue.wakeAt > at) await ctx.db.patch(queue._id, { wakeAt: at })
}
export async function scheduleWebhookDrain(ctx: MutationCtx, delay = 0) {
    await ctx.scheduler.runAfter(
        Math.min(86_400_000, Math.max(0, delay)),
        dispatcher,
        {}
    )
}
async function advanceGuild(ctx: MutationCtx, guildId: string) {
    const next = await ctx.db
        .query("webhookDeliveries")
        .withIndex("guildId_status_nextAttemptAt", (q) =>
            q.eq("guildId", guildId).eq("status", "pending")
        )
        .first()
    const queue = await ctx.db
        .query("webhookDispatchGuilds")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
    if (queue) {
        // Rotate behind already-due tenants, including when clocks tie. One busy
        // tenant cannot keep its oldest delivery timestamp at the queue head.
        if (next)
            await ctx.db.patch(queue._id, {
                wakeAt: Math.max(Date.now() + 1, next.nextAttemptAt),
            })
        else await ctx.db.delete(queue._id)
    } else if (next)
        await wakeWebhookGuild(
            ctx,
            guildId,
            Math.max(Date.now() + 1, next.nextAttemptAt)
        )
}
async function state(ctx: MutationCtx) {
    return ctx.db
        .query("webhookDispatchState")
        .withIndex("name", (q) => q.eq("name", "drain"))
        .unique()
}

export const beginDrain = internalMutation({
    args: {},
    handler: async (ctx) => {
        let current = await state(ctx)
        if (!current) {
            const id = await ctx.db.insert("webhookDispatchState", {
                name: "drain",
                cursor: null,
                migrated: false,
                fence: 0,
                leaseUntil: 0,
            })
            current = (await ctx.db.get(id))!
        }
        if (current.leaseUntil > Date.now()) return null
        // Upgrade old pending deliveries without an unbounded startup scan. New
        // enqueue paths populate the tenant queue transactionally from now on.
        if (!current.migrated) {
            const page = await ctx.db
                .query("webhookDeliveries")
                .paginate({ cursor: current.cursor, numItems: 200 })
            for (const row of page.page)
                if (row.status === "pending")
                    await wakeWebhookGuild(ctx, row.guildId, row.nextAttemptAt)
            await ctx.db.patch(current._id, {
                cursor: page.isDone ? null : page.continueCursor,
                migrated: page.isDone,
            })
            if (!page.isDone) {
                await scheduleWebhookDrain(ctx)
                return null
            }
        }
        const abandoned = await ctx.db
            .query("webhookDeliveries")
            .withIndex("status_processingStartedAt", (q) =>
                q
                    .eq("status", "processing")
                    .lte("processingStartedAt", Date.now() - deliveryLease)
            )
            .take(25)
        for (const row of abandoned) {
            const retry = row.attempt < 6
            await ctx.db.patch(row._id, {
                status: retry ? "pending" : "failed",
                processingStartedAt: undefined,
                nextAttemptAt: Date.now(),
                lastError: "Recovered expired delivery lease.",
            })
            if (retry) await wakeWebhookGuild(ctx, row.guildId)
        }
        // Nothing due and nothing recovered: no lease, no write. The cron
        // calls every minute, and a retry schedules its own drain.
        if (
            !abandoned.length &&
            !(await ctx.db
                .query("webhookDispatchGuilds")
                .withIndex("wakeAt", (q) => q.lte("wakeAt", Date.now()))
                .first())
        )
            return null
        const fence = current.fence + 1
        await ctx.db.patch(current._id, {
            fence,
            leaseUntil: Date.now() + 35_000,
        })
        return fence
    },
})

export const claimDueDelivery = internalMutation({
    args: { drainFence: v.number() },
    handler: async (ctx, args) => {
        const current = await state(ctx)
        if (
            !current ||
            current.fence !== args.drainFence ||
            current.leaseUntil <= Date.now()
        )
            return null
        // Invalid subscriptions consume a bounded slot but cannot block other tenants.
        for (let i = 0; i < 25; i++) {
            const queue = await ctx.db
                .query("webhookDispatchGuilds")
                .withIndex("wakeAt", (q) => q.lte("wakeAt", Date.now()))
                .first()
            if (!queue) return null
            const row = await ctx.db
                .query("webhookDeliveries")
                .withIndex("guildId_status_nextAttemptAt", (q) =>
                    q
                        .eq("guildId", queue.guildId)
                        .eq("status", "pending")
                        .lte("nextAttemptAt", Date.now())
                )
                .first()
            if (!row) {
                await advanceGuild(ctx, queue.guildId)
                continue
            }
            const hook = await ctx.db.get(row.webhookId)
            if (!hook || !hook.enabled || row.attempt >= 6) {
                await ctx.db.patch(row._id, {
                    status: "failed",
                    lastError:
                        "Webhook subscription unavailable or attempts exhausted.",
                })
                await advanceGuild(ctx, queue.guildId)
                continue
            }
            const fence = (row.fence ?? 0) + 1
            await ctx.db.patch(row._id, {
                status: "processing",
                processingStartedAt: Date.now(),
                fence,
                attempt: row.attempt + 1,
            })
            await advanceGuild(ctx, queue.guildId)
            return {
                id: String(row._id),
                url: hook.url,
                signingSecret: hook.secret,
                eventType: row.eventType,
                payload: row.payload,
                attempt: row.attempt + 1,
                fence,
            }
        }
        return null
    },
})

export const finishDelivery = internalMutation({
    args: {
        deliveryId: v.id("webhookDeliveries"),
        fence: v.number(),
        delivered: v.boolean(),
        responseStatus: v.optional(v.number()),
        error: v.optional(v.string()),
        retryAfterMs: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const row = await ctx.db.get(args.deliveryId)
        if (
            !row ||
            row.status !== "processing" ||
            row.fence !== args.fence ||
            (row.processingStartedAt ?? 0) + deliveryLease <= Date.now()
        )
            return false
        const timestamp = new Date().toISOString()
        if (args.delivered) {
            await ctx.db.patch(row._id, {
                status: "delivered",
                processingStartedAt: undefined,
                deliveredAt: timestamp,
                responseStatus: args.responseStatus,
                lastError: undefined,
            })
            if (await ctx.db.get(row.webhookId))
                await ctx.db.patch(row.webhookId, {
                    lastDeliveredAt: timestamp,
                })
        } else {
            const retry = shouldRetryWebhookDelivery(
                args.responseStatus,
                row.attempt
            )
            const nextAttemptAt =
                Date.now() +
                Math.max(
                    webhookRetryDelayMs(row.attempt),
                    Number.isFinite(args.retryAfterMs)
                        ? Math.max(0, args.retryAfterMs!)
                        : 0
                )
            await ctx.db.patch(row._id, {
                status: retry ? "pending" : "failed",
                processingStartedAt: undefined,
                responseStatus: args.responseStatus,
                lastError: args.error?.slice(0, 500),
                nextAttemptAt,
            })
            if (retry) {
                await wakeWebhookGuild(ctx, row.guildId, nextAttemptAt)
                await scheduleWebhookDrain(ctx, nextAttemptAt - Date.now())
            } else if (await ctx.db.get(row.webhookId))
                await ctx.db.patch(row.webhookId, { lastFailureAt: timestamp })
        }
        return true
    },
})

export const endDrain = internalMutation({
    args: { fence: v.number() },
    handler: async (ctx, args) => {
        const current = await state(ctx)
        if (!current || current.fence !== args.fence) return
        await ctx.db.patch(current._id, { leaseUntil: 0 })
        const next = await ctx.db
            .query("webhookDispatchGuilds")
            .withIndex("wakeAt")
            .first()
        if (next) await scheduleWebhookDrain(ctx, next.wakeAt - Date.now())
    },
})
