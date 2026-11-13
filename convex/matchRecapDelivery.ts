import { isMessageEnabled } from "../src/domain/discord-messages/notification-settings"
import { recapRetryDelayMs } from "../src/domain/match-results/recap-delivery"
import { assertInternalSecret } from "./discord_shared"
import { mutation, query } from "./_generated/server"
import { pendingDelivery } from "./matchRecaps"
import { v } from "convex/values"

const owned = {
    secret: v.string(),
    recapId: v.id("matchRecaps"),
    token: v.string(),
}

export const claim = mutation({
    args: {
        secret: v.string(),
        recapId: v.id("matchRecaps"),
        eventId: v.id("events"),
        discordUserId: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const row = await ctx.db.get(args.recapId)
        if (
            !row ||
            row.eventId !== args.eventId ||
            row.discordUserId !== args.discordUserId ||
            row.status !== "pending" ||
            row.deliveryState !== "ready" ||
            (row.deliveryDueAt ?? 0) > Date.now()
        )
            return null
        const event = await ctx.db.get(row.eventId)
        const data = event ? await pendingDelivery(ctx, row, event) : null
        if (!data) return null
        const attempts = (row.deliveryAttempts ?? 0) + 1
        if (attempts > 5) {
            await ctx.db.patch(row._id, {
                deliveryState: "failed",
                deliveryDueAt: undefined,
            })
            return null
        }
        const token = `${row._id}:${attempts}:${Date.now()}`
        await ctx.db.patch(row._id, {
            deliveryState: "claimed",
            deliveryToken: token,
            deliveryAttempts: attempts,
            deliveryDueAt: Date.now() + 300_000,
        })
        return { ...data, token }
    },
})

/** Recheck privacy and publication policy immediately before persisting the send boundary. */
export const begin = mutation({
    args: owned,
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const row = await ctx.db.get(args.recapId)
        if (
            !row ||
            row.deliveryState !== "claimed" ||
            row.deliveryToken !== args.token ||
            (row.deliveryDueAt ?? 0) <= Date.now()
        )
            return { ok: false }
        const event = await ctx.db.get(row.eventId)
        const config = event
            ? await ctx.db
                  .query("discordConfigs")
                  .withIndex("guildId", (q) => q.eq("guildId", event.guildId))
                  .unique()
            : null
        if (
            !event ||
            !config ||
            !isMessageEnabled(config, "matchRecapDm") ||
            !(await pendingDelivery(ctx, row, event))
        ) {
            await ctx.db.patch(row._id, {
                deliveryState: "ready",
                deliveryDueAt: Date.now() + 900_000,
            })
            return { ok: false }
        }
        await ctx.db.patch(row._id, { deliveryState: "started" })
        return { ok: true }
    },
})

export const fail = mutation({
    args: {
        ...owned,
        outcome: v.union(
            v.literal("pre_send"),
            v.literal("refused"),
            v.literal("uncertain")
        ),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const row = await ctx.db.get(args.recapId)
        if (
            !row ||
            row.deliveryToken !== args.token ||
            (row.deliveryDueAt ?? 0) <= Date.now() ||
            row.deliveryState !==
                (args.outcome === "pre_send" ? "claimed" : "started")
        )
            return { ok: false }
        const delay =
            args.outcome === "pre_send"
                ? recapRetryDelayMs(row.deliveryAttempts ?? 5)
                : null
        await ctx.db.patch(row._id, {
            deliveryState:
                delay !== null
                    ? "ready"
                    : args.outcome === "pre_send"
                      ? "failed"
                      : args.outcome,
            deliveryDueAt: delay !== null ? Date.now() + delay : undefined,
        })
        return { ok: true }
    },
})

/** Bounded indexed discovery: no whole recap table or overlapping polling passes. */
export const due = mutation({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const now = Date.now()
        for (const state of ["claimed", "started"] as const) {
            const rows = await ctx.db
                .query("matchRecaps")
                .withIndex("deliveryState_deliveryDueAt", (q) =>
                    q.eq("deliveryState", state).lte("deliveryDueAt", now)
                )
                .take(10)
            for (const row of rows) {
                const delay =
                    state === "claimed"
                        ? recapRetryDelayMs(row.deliveryAttempts ?? 5)
                        : null
                await ctx.db.patch(row._id, {
                    deliveryState:
                        state === "started"
                            ? "uncertain"
                            : delay !== null
                              ? "ready"
                              : "failed",
                    deliveryDueAt: delay !== null ? now + delay : undefined,
                })
            }
        }
        const rows = await ctx.db
            .query("matchRecaps")
            .withIndex("deliveryState_deliveryDueAt", (q) =>
                q.eq("deliveryState", "ready").lte("deliveryDueAt", now)
            )
            .take(10)
        return [...new Set(rows.map((row) => row.eventId))]
    },
})

/** Defer untouched policy-blocked rows so another event can enter discovery. */
export const deferEvent = mutation({
    args: { secret: v.string(), eventId: v.id("events") },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const rows = await ctx.db
            .query("matchRecaps")
            .withIndex("eventId_deliveryState_deliveryDueAt", (q) =>
                q
                    .eq("eventId", args.eventId)
                    .eq("deliveryState", "ready")
                    .lte("deliveryDueAt", Date.now())
            )
            .take(25)
        for (const row of rows)
            await ctx.db.patch(row._id, { deliveryDueAt: Date.now() + 900_000 })
    },
})

/** Receipts are event/tenant scoped, including unproven pre-upgrade rows. */
export const inspect = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        eventId: v.id("events"),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const event = await ctx.db.get(args.eventId)
        if (!event || event.guildId !== args.guildId)
            throw new Error("Event not found")
        const page = await ctx.db
            .query("matchRecaps")
            .withIndex("eventId", (q) => q.eq("eventId", event._id))
            .paginate({ cursor: args.cursor, numItems: 25 })
        return {
            ...page,
            page: page.page.map((row) => ({
                recapId: row._id,
                recipientId: row.discordUserId,
                status: row.status,
                receipt: row.deliveryState ?? "legacy_unproven",
                attempts: row.deliveryAttempts ?? 0,
                dueAt: row.deliveryDueAt,
                messageId: row.deliveryMessageId,
            })),
        }
    },
})

export const reconcile = mutation({
    args: {
        secret: v.string(),
        recapId: v.id("matchRecaps"),
        guildId: v.string(),
        operator: v.string(),
        evidence: v.string(),
        action: v.union(v.literal("confirm"), v.literal("proven_not_sent")),
        messageId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        if (
            !args.operator.trim() ||
            args.operator.length > 200 ||
            args.evidence.trim().length < 10 ||
            args.evidence.length > 2000 ||
            (args.messageId !== undefined &&
                !/^\d{17,20}$/.test(args.messageId))
        )
            throw new Error("Operator and delivery evidence required")
        const row = await ctx.db.get(args.recapId)
        const event = row ? await ctx.db.get(row.eventId) : null
        if (!row || !event || event.guildId !== args.guildId)
            throw new Error("Recap not found")
        if (
            (row.deliveryState === "claimed" ||
                row.deliveryState === "started") &&
            (row.deliveryDueAt ?? 0) > Date.now()
        )
            throw new Error("Active recap owner")
        if (
            row.status === "sent" ||
            row.deliveryState === "confirmed" ||
            row.deliveryState === "refused"
        )
            throw new Error("Recap already settled")
        if (
            args.action === "proven_not_sent" &&
            ((row.deliveryAttempts ?? 0) >= 5 ||
                !(await pendingDelivery(ctx, row, event)))
        )
            throw new Error("Recap not eligible for retry")
        await ctx.db.insert("matchRecapDeliveryAudits", {
            recapId: row._id,
            guildId: args.guildId,
            operator: args.operator,
            evidence: args.evidence,
            action: args.action,
            at: Date.now(),
            ...(args.messageId ? { messageId: args.messageId } : {}),
        })
        await ctx.db.patch(row._id, {
            status: args.action === "confirm" ? "sent" : "pending",
            deliveryState: args.action === "confirm" ? "confirmed" : "ready",
            deliveryToken: undefined,
            deliveryDueAt:
                args.action === "confirm" ? undefined : Date.now() + 60_000,
            ...(args.action === "confirm"
                ? { sentAt: new Date().toISOString() }
                : {}),
            ...(args.messageId ? { deliveryMessageId: args.messageId } : {}),
        })
        return { ok: true }
    },
})

export const audit = query({
    args: {
        secret: v.string(),
        recapId: v.id("matchRecaps"),
        guildId: v.string(),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const row = await ctx.db.get(args.recapId)
        const event = row ? await ctx.db.get(row.eventId) : null
        if (!row || !event || event.guildId !== args.guildId)
            throw new Error("Recap not found")
        return ctx.db
            .query("matchRecapDeliveryAudits")
            .withIndex("recapId", (q) => q.eq("recapId", row._id))
            .paginate({ cursor: args.cursor, numItems: 25 })
    },
})
