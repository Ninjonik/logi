import { v } from "convex/values"

import {
    decideManualReminder,
    remainingManualReminderRecipients,
    resolveManualReminderRecipients,
    type ManualReminderAudience,
} from "../src/domain/events/manual-reminders"
import { mutation, query, type MutationCtx } from "./_generated/server"
import { assertInternalSecret } from "./discord_shared"
import type { Doc, Id } from "./_generated/dataModel"

const audience = v.union(v.literal("unanswered"), v.literal("unconfirmed"))
/** A claim the bot never finished may be taken again after this time. */
const CLAIM_TIMEOUT_MS = 5 * 60 * 1000

async function currentRecipients(
    ctx: Pick<MutationCtx, "db">,
    event: Doc<"events">,
    target: ManualReminderAudience,
    now: Date
) {
    const [roster, assignments] = await Promise.all([
        ctx.db
            .query("rosters")
            .withIndex("eventId", (q) => q.eq("eventId", event._id))
            .unique(),
        ctx.db
            .query("userAssignments")
            .withIndex("serverId", (q) => q.eq("serverId", event.guildId))
            .collect(),
    ])
    return resolveManualReminderRecipients({
        audience: target,
        event: {
            kind: event.kind,
            gameId: event.gameId,
            status: event.status,
            isDraft: event.isDraft,
            registrationEnd: event.registrationEnd,
            meetingStart: event.meetingStart,
            allowedSignupStatuses: event.allowedSignupStatuses,
            participants: event.participants ?? [],
            absenceNotices: event.absenceNotices ?? [],
        },
        roster,
        assignments,
        now,
    })
}

/**
 * Queues reminder DMs a clan admin asked for (design D3/E3 "Připomenout").
 * The Next route checks the session, the clan admin right and the origin and
 * passes the admin's Discord ID; this function checks the internal secret and
 * that the match belongs to the clan. A reminder still waiting for the bot is
 * answered with its count, and the same audience of a match is reminded at
 * most once per cool-down.
 */
export const requestManual = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        eventId: v.string(),
        audience,
        requestedBy: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const eventId = ctx.db.normalizeId("events", args.eventId)
        const event = eventId ? await ctx.db.get(eventId) : null
        if (!event || event.guildId !== args.guildId) {
            return { status: "not_found" as const }
        }
        const now = new Date()
        const previous = await ctx.db
            .query("eventReminderRequests")
            .withIndex("eventId_requestedAt", (q) => q.eq("eventId", event._id))
            .order("desc")
            .take(20)
        const decision = decideManualReminder({
            audience: args.audience,
            previous: previous.map((request) => ({
                audience: request.audience,
                requestedAt: request.requestedAt,
                status: request.status,
                recipientCount: request.recipientIds.length,
            })),
            now,
        })
        if (decision.kind === "already_queued") {
            return {
                status: "queued" as const,
                queued: decision.recipientCount,
            }
        }
        if (decision.kind === "rate_limited") {
            return {
                status: "rate_limited" as const,
                retryAt: decision.retryAt,
            }
        }

        const recipients = await currentRecipients(
            ctx,
            event,
            args.audience,
            now
        )
        if (!recipients.ok) {
            return {
                status: "unavailable" as const,
                reason: recipients.reason,
            }
        }
        if (recipients.userIds.length === 0) {
            return { status: "queued" as const, queued: 0 }
        }
        await ctx.db.insert("eventReminderRequests", {
            guildId: event.guildId,
            eventId: event._id,
            audience: args.audience,
            requestedBy: args.requestedBy,
            requestedAt: now.toISOString(),
            recipientIds: recipients.userIds,
            status: "pending",
        })
        return {
            status: "queued" as const,
            queued: recipients.userIds.length,
        }
    },
})

/** Pending reminders, watched by the bot. */
export const listPending = query({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const pending = await ctx.db
            .query("eventReminderRequests")
            .withIndex("status", (q) => q.eq("status", "pending"))
            .take(50)
        return pending.map((request) => ({
            id: String(request._id),
            eventId: String(request.eventId),
            guildId: request.guildId,
        }))
    },
})

/**
 * The bot takes a reminder before sending it. It gets the recipients who
 * still have not answered or confirmed, so nobody who reacted in the
 * meantime is reminded.
 */
export const claim = mutation({
    args: { secret: v.string(), requestId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const requestId = ctx.db.normalizeId(
            "eventReminderRequests",
            args.requestId
        )
        const request = requestId ? await ctx.db.get(requestId) : null
        const now = new Date()
        if (
            !request ||
            (request.status !== "pending" &&
                !(
                    request.status === "processing" &&
                    now.getTime() - new Date(request.claimedAt ?? 0).getTime() >
                        CLAIM_TIMEOUT_MS
                ))
        ) {
            return null
        }
        const event = await ctx.db.get(request.eventId)
        if (!event || event.guildId !== request.guildId) {
            await ctx.db.patch(request._id, {
                status: "failed",
                completedAt: now.toISOString(),
                error: "Match not found.",
            })
            return null
        }
        const recipientIds = remainingManualReminderRecipients({
            requested: request.recipientIds,
            current: await currentRecipients(ctx, event, request.audience, now),
        })
        await ctx.db.patch(request._id, {
            status: "processing",
            claimedAt: now.toISOString(),
        })
        return {
            id: String(request._id),
            eventId: String(request.eventId),
            guildId: request.guildId,
            audience: request.audience,
            recipientIds,
        }
    },
})

async function finish(
    ctx: MutationCtx,
    requestId: string,
    patch: Partial<Doc<"eventReminderRequests">>
) {
    const id = ctx.db.normalizeId("eventReminderRequests", requestId)
    const request = id ? await ctx.db.get(id) : null
    if (!request || request.status !== "processing") return
    await ctx.db.patch(request._id as Id<"eventReminderRequests">, {
        ...patch,
        completedAt: new Date().toISOString(),
    })
}

export const complete = mutation({
    args: {
        secret: v.string(),
        requestId: v.string(),
        sentCount: v.number(),
        // Recipients Discord refused (closed DMs); older bots omit it.
        failedUserIds: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        await finish(ctx, args.requestId, {
            status: "sent",
            sentCount: Math.max(0, Math.floor(args.sentCount)),
            ...(args.failedUserIds
                ? { failedUserIds: args.failedUserIds.slice(0, 500) }
                : {}),
        })
    },
})

/** How long the match page keeps showing a reminder's delivery result. */
const OUTCOME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/**
 * The newest finished reminder of a match, for the match page (board
 * L2-60..62): who sent it and when, how many DMs arrived and who has their
 * DMs closed. The Next server reads it for a clan admin of the clan.
 */
export const latestOutcome = query({
    args: { secret: v.string(), guildId: v.string(), eventId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const eventId = ctx.db.normalizeId("events", args.eventId)
        const event = eventId ? await ctx.db.get(eventId) : null
        if (!event || event.guildId !== args.guildId) return null
        const recent = await ctx.db
            .query("eventReminderRequests")
            .withIndex("eventId_requestedAt", (q) => q.eq("eventId", event._id))
            .order("desc")
            .take(10)
        const now = Date.now()
        const finished = recent.find(
            (row) =>
                (row.status === "sent" || row.status === "failed") &&
                now - Date.parse(row.completedAt ?? row.requestedAt) <
                    OUTCOME_WINDOW_MS
        )
        if (!finished) return null
        return {
            audience: finished.audience,
            status: finished.status,
            requestedAt: finished.requestedAt,
            completedAt: finished.completedAt ?? null,
            requestedBy: finished.requestedBy,
            recipientCount: finished.recipientIds.length,
            sentCount: finished.sentCount ?? 0,
            failedUserIds: finished.failedUserIds ?? [],
        }
    },
})

export const fail = mutation({
    args: { secret: v.string(), requestId: v.string(), error: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        await finish(ctx, args.requestId, {
            status: "failed",
            error: args.error.slice(0, 500),
        })
    },
})
