import {
    nextRevision,
    type IntegrationChange,
} from "../src/domain/integrations/change"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import { wakeWebhookGuild } from "./webhookQueue"

export async function integrationRevision(
    ctx: Pick<QueryCtx, "db">,
    guildId: string
) {
    const head = await ctx.db
        .query("integrationHeads")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
    return head?.revision ?? "0"
}

export async function allocateIntegrationRevision(
    ctx: MutationCtx,
    guildId: string
): Promise<string> {
    const head = await ctx.db
        .query("integrationHeads")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
    const revision = nextRevision(head?.revision ?? "0")
    if (head) await ctx.db.patch(head._id, { revision })
    else
        await ctx.db.insert("integrationHeads", {
            guildId,
            revision,
        })
    return revision
}

/** Called only inside the authoritative writer's transaction; never an action. */
export async function appendIntegrationChange(
    ctx: MutationCtx,
    change: Omit<IntegrationChange, "revision">
): Promise<string> {
    const revision = await allocateIntegrationRevision(ctx, change.guildId)
    const hooks = await ctx.db
        .query("webhookSubscriptions")
        .withIndex("guildId", (q) => q.eq("guildId", change.guildId))
        .collect()
    let enqueued = false
    const eventType =
        change.resource === "membership-summaries"
            ? "membership.changed"
            : "integration.changed"
    for (const hook of hooks) {
        if (!hook.enabled || !hook.eventTypes.includes(eventType)) continue
        const createdAt = new Date().toISOString()
        await ctx.db.insert("webhookDeliveries", {
            webhookId: hook._id,
            guildId: change.guildId,
            eventType,
            payload: JSON.stringify({
                type: eventType,
                guildId: change.guildId,
                createdAt,
                resource: { ...change, revision },
            }),
            attempt: 0,
            status: "pending",
            nextAttemptAt: Date.now(),
            createdAt,
        })
        enqueued = true
    }
    if (enqueued) {
        await wakeWebhookGuild(ctx, change.guildId)
        await ctx.scheduler.runAfter(
            0,
            makeFunctionReference<"action">("webhookDispatcher:deliverDue"),
            {}
        )
    }
    return revision
}
