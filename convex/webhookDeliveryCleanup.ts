import type { MutationCtx } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import type { Id } from "./_generated/dataModel"

/** Deliveries of a removed subscription deleted per transaction. */
export const WEBHOOK_DELIVERY_BATCH = 250

/**
 * Deletes one batch of a webhook subscription's deliveries through the
 * `webhookId` index and schedules `housekeeping:removeWebhookDeliveries` for
 * the next one while the batch was full. `webhooks:remove` calls it in the
 * transaction that deletes the subscription, so a removed subscription
 * leaves no delivery history behind. A module without function definitions,
 * so its importers bundle no other Convex function (ARCHITECTURE.md, "Convex
 * hot paths").
 */
export async function deleteWebhookDeliveries(
    ctx: Pick<MutationCtx, "db" | "scheduler">,
    webhookId: Id<"webhookSubscriptions">
) {
    const rows = await ctx.db
        .query("webhookDeliveries")
        .withIndex("webhookId", (q) => q.eq("webhookId", webhookId))
        .take(WEBHOOK_DELIVERY_BATCH)
    for (const row of rows) await ctx.db.delete(row._id)
    const more = rows.length === WEBHOOK_DELIVERY_BATCH
    if (more)
        await ctx.scheduler.runAfter(
            0,
            makeFunctionReference<"mutation">(
                "housekeeping:removeWebhookDeliveries"
            ),
            { webhookId }
        )
    return { deleted: rows.length, more }
}
