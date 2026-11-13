import { TEAM_REQUEST_NOTIFICATION_ATTEMPTS } from "../src/domain/teams/team-request"
import { assertInternalSecret } from "./discord_shared"
import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

/** Persist the send boundary before contacting Discord. Never reclaim started sends. */
export const begin = mutation({
    args: {
        secret: v.string(),
        requestId: v.id("teamRequests"),
        claimToken: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const row = await ctx.db.get(args.requestId)
        if (
            !row ||
            row.notificationStatus !== "pending" ||
            row.notificationClaimToken !== args.claimToken ||
            row.notificationDeliveryState !== "ready" ||
            row.requestedBy !== row.notificationRecipientId ||
            (row.notificationLeaseUntil ?? 0) <= Date.now()
        )
            return { ok: false }
        await ctx.db.patch(row._id, { notificationDeliveryState: "started" })
        return { ok: true }
    },
})

/** Small tenant-scoped pages; missing receipts are explicitly unproven. */
export const inspect = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const page = await ctx.db
            .query("teamRequests")
            .withIndex("guildId_createdAt", (q) =>
                q.eq("guildId", args.guildId)
            )
            .order("desc")
            .paginate({ cursor: args.cursor, numItems: 25 })
        return {
            ...page,
            page: page.page.map((row) => ({
                requestId: row._id,
                guildId: row.guildId,
                status: row.notificationStatus,
                receipt: row.notificationDeliveryState ?? "legacy_unproven",
                attempts: row.notificationAttempts,
                recipientId: row.notificationRecipientId ?? row.requestedBy,
                messageId: row.notificationMessageId,
                leaseUntil: row.notificationLeaseUntil,
            })),
        }
    },
})

/** Evidence cannot override an active sender or silently grant a new retry budget. */
export const reconcile = mutation({
    args: {
        secret: v.string(),
        requestId: v.id("teamRequests"),
        guildId: v.string(),
        action: v.union(v.literal("confirm"), v.literal("proven_not_sent")),
        operator: v.string(),
        evidence: v.string(),
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
            throw new Error("Operator and concrete delivery evidence required")
        const row = await ctx.db.get(args.requestId)
        if (!row || row.guildId !== args.guildId)
            throw new Error("Request not found")
        if ((row.notificationLeaseUntil ?? 0) > Date.now())
            throw new Error("Active notification owner")
        if (
            row.notificationDeliveryState === "confirmed" ||
            row.notificationDeliveryState === "refused" ||
            row.notificationStatus === "sent" ||
            row.notificationStatus === "none"
        )
            throw new Error("Notification already settled")
        if (
            args.action === "proven_not_sent" &&
            row.notificationAttempts >= TEAM_REQUEST_NOTIFICATION_ATTEMPTS
        )
            throw new Error("Notification attempt budget exhausted")
        await ctx.db.insert("teamRequestDeliveryAudits", {
            requestId: row._id,
            guildId: row.guildId,
            operator: args.operator,
            evidence: args.evidence,
            action: args.action,
            at: Date.now(),
            ...(args.messageId ? { messageId: args.messageId } : {}),
        })
        await ctx.db.patch(row._id, {
            notificationStatus: args.action === "confirm" ? "sent" : "pending",
            notificationDeliveryState:
                args.action === "confirm" ? "confirmed" : "ready",
            notificationNextAttemptAt:
                args.action === "confirm" ? null : Date.now() + 60_000,
            notificationLeaseUntil: null,
            notificationClaimToken: undefined,
            notificationRecipientId: row.requestedBy,
            ...(args.action === "confirm"
                ? { notificationSentAt: new Date().toISOString() }
                : {}),
            ...(args.messageId
                ? { notificationMessageId: args.messageId }
                : {}),
        })
        return { ok: true }
    },
})

export const audit = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        requestId: v.id("teamRequests"),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const row = await ctx.db.get(args.requestId)
        if (!row || row.guildId !== args.guildId)
            throw new Error("Request not found")
        return ctx.db
            .query("teamRequestDeliveryAudits")
            .withIndex("requestId", (q) => q.eq("requestId", row._id))
            .paginate({ cursor: args.cursor, numItems: 25 })
    },
})
