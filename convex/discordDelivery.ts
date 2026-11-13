import { mutation, query, type MutationCtx } from "./_generated/server"
import { assertInternalSecret } from "./discord_shared"
import { v } from "convex/values"

export const deliveryOwner = v.object({
    kind: v.union(
        v.literal("reminder"),
        v.literal("roster"),
        v.literal("dispatch")
    ),
    id: v.string(),
    token: v.string(),
})
type Owner = {
    kind: "reminder" | "roster" | "dispatch"
    id: string
    token: string
}
export async function ownedDelivery(ctx: MutationCtx, owner: Owner) {
    const table =
        owner.kind === "reminder"
            ? "eventReminderRequests"
            : owner.kind === "roster"
              ? "rosterChangeRequests"
              : "discordScheduledDispatches"
    const id = ctx.db.normalizeId(table, owner.id)
    const row = id ? await ctx.db.get(id) : null
    if (
        !row ||
        row.status !== "processing" ||
        row.claimToken !== owner.token ||
        (row.leaseUntil ?? 0) <= Date.now()
    )
        throw new Error("Delivery ownership lost")
    return row
}
function scopeOf(
    row: { guildId: string; eventId: string },
    owner: Owner,
    phase: string
) {
    if (phase.length > 100) throw new Error("Invalid delivery phase")
    return owner.kind === "dispatch"
        ? `${row.guildId}:${row.eventId}:${phase}`
        : `${owner.kind}:${owner.id}`
}

export const plan = mutation({
    args: {
        secret: v.string(),
        owner: deliveryOwner,
        phase: v.string(),
        recipientIds: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const row = await ownedDelivery(ctx, args.owner)
        const scope = scopeOf(row, args.owner, args.phase)
        const plan = await ctx.db
            .query("discordDeliveryPlans")
            .withIndex("scope", (q) => q.eq("scope", scope))
            .unique()
        if (!plan) {
            const recipientIds = [...new Set(args.recipientIds)]
            await ctx.db.insert("discordDeliveryPlans", {
                scope,
                ownerKind: args.owner.kind,
                ownerId: args.owner.id,
                eventId: row.eventId,
                expiresAt: Date.now() + 30 * 86400000,
                recipientIds,
                createdAt: Date.now(),
            })
            return recipientIds
        }
        // Resume never broadens an original audience; caller must also supply
        // only recipients who remain eligible under fresh authority checks.
        const eligible = new Set(args.recipientIds)
        return plan.recipientIds.filter((id) => eligible.has(id))
    },
})

export const begin = mutation({
    args: {
        secret: v.string(),
        owner: deliveryOwner,
        phase: v.string(),
        key: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const row = await ownedDelivery(ctx, args.owner)
        const scope = scopeOf(row, args.owner, args.phase)
        if (args.key.length > 200) throw new Error("Invalid delivery key")
        if (args.key.startsWith("dm:")) {
            const plan = await ctx.db
                .query("discordDeliveryPlans")
                .withIndex("scope", (q) => q.eq("scope", scope))
                .unique()
            if (!plan?.recipientIds.includes(args.key.slice(3)))
                throw new Error("Recipient is outside delivery plan")
        }
        if (!args.key.startsWith("dm:")) {
            const plan = await ctx.db
                .query("discordDeliveryPlans")
                .withIndex("scope", (q) => q.eq("scope", scope))
                .unique()
            if (!plan)
                await ctx.db.insert("discordDeliveryPlans", {
                    scope,
                    ownerKind: args.owner.kind,
                    ownerId: args.owner.id,
                    eventId: row.eventId,
                    recipientIds: [],
                    createdAt: Date.now(),
                    expiresAt: Date.now() + 30 * 86400000,
                })
        }
        const prior = await ctx.db
            .query("discordDeliveryEffects")
            .withIndex("scope_key", (q) =>
                q.eq("scope", scope).eq("key", args.key)
            )
            .unique()
        if (prior) {
            if (prior.state === "started") {
                await ctx.db.patch(prior._id, {
                    state: "uncertain",
                    updatedAt: Date.now(),
                })
                return "uncertain" as const
            }
            return prior.state
        }
        await ctx.db.insert("discordDeliveryEffects", {
            scope,
            key: args.key,
            claimToken: args.owner.token,
            state: "started",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        })
        return "execute" as const
    },
})

export const finish = mutation({
    args: {
        secret: v.string(),
        owner: deliveryOwner,
        phase: v.string(),
        key: v.string(),
        state: v.union(
            v.literal("sent"),
            v.literal("refused"),
            v.literal("uncertain")
        ),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const row = await ownedDelivery(ctx, args.owner)
        const scope = scopeOf(row, args.owner, args.phase)
        const receipt = await ctx.db
            .query("discordDeliveryEffects")
            .withIndex("scope_key", (q) =>
                q.eq("scope", scope).eq("key", args.key)
            )
            .unique()
        if (
            !receipt ||
            receipt.claimToken !== args.owner.token ||
            receipt.state !== "started"
        )
            throw new Error("Effect ownership lost")
        await ctx.db.patch(receipt._id, {
            state: args.state,
            updatedAt: Date.now(),
        })
    },
})

export const reset = mutation({
    args: {
        secret: v.string(),
        owner: deliveryOwner,
        phase: v.string(),
        key: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const row = await ownedDelivery(ctx, args.owner)
        const scope = scopeOf(row, args.owner, args.phase)
        const receipt = await ctx.db
            .query("discordDeliveryEffects")
            .withIndex("scope_key", (q) =>
                q.eq("scope", scope).eq("key", args.key)
            )
            .unique()
        if (
            !receipt ||
            receipt.state !== "started" ||
            receipt.claimToken !== args.owner.token
        )
            throw new Error("Effect ownership lost")
        await ctx.db.delete(receipt._id)
    },
})

export async function requestDeliverySummary(
    ctx: MutationCtx,
    kind: "reminder" | "roster",
    id: string
) {
    const rows = await ctx.db
        .query("discordDeliveryEffects")
        .withIndex("scope", (q) => q.eq("scope", `${kind}:${id}`))
        .collect()
    return {
        sent: rows
            .filter((row) => row.key.startsWith("dm:") && row.state === "sent")
            .map((row) => row.key.slice(3)),
        refused: rows
            .filter(
                (row) => row.key.startsWith("dm:") && row.state === "refused"
            )
            .map((row) => row.key.slice(3)),
        uncertain: rows.some(
            (row) => row.state === "uncertain" || row.state === "started"
        ),
        digest: rows.some(
            (row) => row.key === "digest" && row.state === "sent"
        ),
    }
}

export async function ownerDeliverySummary(
    ctx: MutationCtx,
    owner: Owner,
    phase: string
) {
    const row = await ownedDelivery(ctx, owner)
    const scope = scopeOf(row, owner, phase)
    const effects = await ctx.db
        .query("discordDeliveryEffects")
        .withIndex("scope", (q) => q.eq("scope", scope))
        .collect()
    return {
        guildId: row.guildId,
        eventId: String(row.eventId),
        sent: effects
            .filter(
                (effect) =>
                    effect.key.startsWith("dm:") && effect.state === "sent"
            )
            .map((effect) => effect.key.slice(3)),
        refused: effects
            .filter(
                (effect) =>
                    effect.key.startsWith("dm:") && effect.state === "refused"
            )
            .map((effect) => effect.key.slice(3)),
    }
}

/** Bounded retention; never erase receipts for an active/retryable owner. */
export async function pruneDeliveryPlans(ctx: MutationCtx) {
    const now = Date.now()
    const plans = await ctx.db
        .query("discordDeliveryPlans")
        .withIndex("expiresAt", (q) => q.lte("expiresAt", now))
        .take(5)
    for (const plan of plans) {
        const unresolved =
            (await ctx.db
                .query("discordDeliveryEffects")
                .withIndex("scope_state", (q) =>
                    q.eq("scope", plan.scope).eq("state", "uncertain")
                )
                .first()) ??
            (await ctx.db
                .query("discordDeliveryEffects")
                .withIndex("scope_state", (q) =>
                    q.eq("scope", plan.scope).eq("state", "started")
                )
                .first())
        if (unresolved) {
            await ctx.db.patch(plan._id, { expiresAt: now + 86400000 })
            continue
        }
        const table =
            plan.ownerKind === "reminder"
                ? "eventReminderRequests"
                : plan.ownerKind === "roster"
                  ? "rosterChangeRequests"
                  : "discordScheduledDispatches"
        const id = ctx.db.normalizeId(table, plan.ownerId)
        const owner = id ? await ctx.db.get(id) : null
        const event =
            plan.ownerKind === "dispatch"
                ? await ctx.db.get(plan.eventId)
                : null
        if (
            owner?.status === "pending" ||
            owner?.status === "processing" ||
            (event &&
                (event.status !== "concluded" ||
                    Date.parse(event.gameEnd) > now - 7 * 86400000))
        ) {
            await ctx.db.patch(plan._id, { expiresAt: now + 86400000 })
            continue
        }
        const effects = await ctx.db
            .query("discordDeliveryEffects")
            .withIndex("scope", (q) => q.eq("scope", plan.scope))
            .take(100)
        for (const effect of effects) await ctx.db.delete(effect._id)
        if (effects.length < 100) await ctx.db.delete(plan._id)
    }
}

/** Exact-scope operator reads; legacy rows are evidence gaps, never resend authorization. */
export const inspect = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        kind: v.union(v.literal("reminder"), v.literal("roster")),
        requestId: v.string(),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const table =
            args.kind === "reminder"
                ? "eventReminderRequests"
                : "rosterChangeRequests"
        const id = ctx.db.normalizeId(table, args.requestId)
        const owner = id ? await ctx.db.get(id) : null
        if (!owner || owner.guildId !== args.guildId)
            throw new Error("Delivery scope mismatch")
        const receipts = await ctx.db
            .query("discordDeliveryEffects")
            .withIndex("scope_key", (q) =>
                q.eq("scope", `${args.kind}:${args.requestId}`)
            )
            .paginate({ cursor: args.cursor, numItems: 50 })
        return {
            status: owner.status,
            legacyUnproven: !owner.resumable,
            error: owner.error ?? null,
            receipts,
        }
    },
})

export const requests = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        kind: v.union(v.literal("reminder"), v.literal("roster")),
        status: v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("sent"),
            v.literal("failed")
        ),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const page =
            args.kind === "reminder"
                ? await ctx.db
                      .query("eventReminderRequests")
                      .withIndex("guildId_status_requestedAt", (q) =>
                          q
                              .eq("guildId", args.guildId)
                              .eq("status", args.status)
                      )
                      .paginate({ cursor: args.cursor, numItems: 25 })
                : await ctx.db
                      .query("rosterChangeRequests")
                      .withIndex("guildId_status_requestedAt", (q) =>
                          q
                              .eq("guildId", args.guildId)
                              .eq("status", args.status)
                      )
                      .paginate({ cursor: args.cursor, numItems: 25 })
        return {
            ...page,
            page: page.page.map((row) => ({
                id: String(row._id),
                eventId: String(row.eventId),
                status: row.status,
                requestedAt: row.requestedAt,
                legacyUnproven: !row.resumable,
                error: row.error ?? null,
            })),
        }
    },
})

export const inspectAutomatic = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        eventId: v.id("events"),
        phase: v.string(),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const event = await ctx.db.get(args.eventId)
        if (!event || event.guildId !== args.guildId || args.phase.length > 100)
            throw new Error("Delivery scope mismatch")
        const scope = `${args.guildId}:${args.eventId}:${args.phase}`
        const plan = await ctx.db
            .query("discordDeliveryPlans")
            .withIndex("scope", (q) => q.eq("scope", scope))
            .unique()
        const receipts = await ctx.db
            .query("discordDeliveryEffects")
            .withIndex("scope_key", (q) => q.eq("scope", scope))
            .paginate({ cursor: args.cursor, numItems: 50 })
        return { legacyUnproven: !plan, receipts }
    },
})
