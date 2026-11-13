import {
    requestDeliverySummary,
    deliveryOwner,
    ownerDeliverySummary,
} from "./discordDelivery"
import { v } from "convex/values"

import {
    decideManualReminder,
    remainingManualReminderRecipients,
    resolveManualReminderRecipients,
    type ManualReminderAudience,
} from "../src/domain/events/manual-reminders"
import {
    automaticReminderOutcome,
    mergeAutomaticReminderRun,
    newestReminderOutcome,
} from "../src/domain/events/reminder-delivery"
import {
    getSignupReminderDueAt,
    resolveSignupReminderStatuses,
} from "../src/domain/events/scheduled-job-policy"
import { lastSignupReminderAt } from "../src/infrastructure/convex/signup-reminder-state"
import { mutation, query, type MutationCtx } from "./_generated/server"
import { assertInternalSecret } from "./discord_shared"
import type { Doc, Id } from "./_generated/dataModel"

export async function claimSignupRunForEvent(
    ctx: MutationCtx,
    args: { guildId: string; eventId: string },
    resume = false
) {
    const id = ctx.db.normalizeId("events", args.eventId)
    const event = id ? await ctx.db.get(id) : null
    if (
        !event ||
        event.guildId !== args.guildId ||
        event.isDraft ||
        event.kind !== "match" ||
        event.status !== "registration" ||
        !resolveSignupReminderStatuses(event.signupReminderStatuses).length
    )
        return false
    const now = new Date()
    if (resume) return Date.parse(event.registrationEnd) > now.getTime()
    const lastAt = await lastSignupReminderAt(ctx, event, now.getTime())
    const dueAt = getSignupReminderDueAt(
        event.createdAt,
        event.registrationEnd,
        now,
        true,
        event.registrationStart,
        lastAt
    )
    if (!dueAt || Date.parse(dueAt) > now.getTime()) return false
    await ctx.db.patch(event._id, {
        signupReminderClaimedAt: now.toISOString(),
    })
    return true
}
/** Reserve a scheduled run atomically before Discord sends, across bot processes. */
export const claimSignupRun = mutation({
    args: { secret: v.string(), guildId: v.string(), eventId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        return claimSignupRunForEvent(ctx, args)
    },
})

const audience = v.union(v.literal("unanswered"), v.literal("unconfirmed"))

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
            .withIndex("status_retryAt", (q) =>
                q.eq("status", "pending").lte("retryAt", Date.now())
            )
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
    args: {
        secret: v.string(),
        requestId: v.string(),
        fenced: v.optional(v.boolean()),
        resumable: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const requestId = ctx.db.normalizeId(
            "eventReminderRequests",
            args.requestId
        )
        const request = requestId ? await ctx.db.get(requestId) : null
        const now = new Date()
        if (request?.resumable && !args.resumable) return null
        if (args.resumable && !args.fenced) return null
        if (
            !request ||
            request.status !== "pending" ||
            (request.retryAt ?? 0) > Date.now()
        )
            return null
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
            resumable: args.resumable,
            deliveryAttempts: (request.deliveryAttempts ?? 0) + 1,
            claimedAt: now.toISOString(),
            claimToken: args.fenced
                ? `${request._id}:${now.toISOString()}`
                : undefined,
            leaseUntil: args.fenced ? now.getTime() + 5 * 60_000 : undefined,
        })
        return {
            claimToken: args.fenced
                ? `${request._id}:${now.toISOString()}`
                : undefined,
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
    patch: Partial<Doc<"eventReminderRequests">>,
    claimToken?: string
) {
    const id = ctx.db.normalizeId("eventReminderRequests", requestId)
    const request = id ? await ctx.db.get(id) : null
    if (
        !request ||
        request.status !== "processing" ||
        (request.claimToken !== undefined && request.claimToken !== claimToken)
    )
        return
    if (
        request.resumable &&
        patch.status === "failed" &&
        (request.deliveryAttempts ?? 0) < 5
    ) {
        patch = {
            ...patch,
            status: "pending",
            retryAt: Date.now() + 60_000,
            leaseUntil: undefined,
            claimToken: undefined,
        }
    } else if (
        request.resumable &&
        (patch.status === "sent" || patch.status === "failed")
    ) {
        const summary = await requestDeliverySummary(ctx, "reminder", requestId)
        patch = {
            ...patch,
            status:
                patch.status === "failed" || summary.uncertain
                    ? "failed"
                    : "sent",
            error: summary.uncertain ? "delivery_uncertain" : patch.error,
            sentCount: summary.sent.length,
            failedUserIds: summary.refused,
        }
    }
    await ctx.db.patch(request._id as Id<"eventReminderRequests">, {
        ...patch,
        completedAt: new Date().toISOString(),
    })
}

export const complete = mutation({
    args: {
        secret: v.string(),
        requestId: v.string(),
        claimToken: v.optional(v.string()),
        sentCount: v.number(),
        // Recipients Discord refused (closed DMs); older bots omit it.
        failedUserIds: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        await finish(
            ctx,
            args.requestId,
            {
                status: "sent",
                sentCount: Math.max(0, Math.floor(args.sentCount)),
                ...(args.failedUserIds
                    ? { failedUserIds: args.failedUserIds.slice(0, 500) }
                    : {}),
            },
            args.claimToken
        )
    },
})

/** How long the match page keeps showing a reminder's delivery result. */
const OUTCOME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/**
 * The bot records who a scheduled sign-up or attendance reminder reached
 * (board L2-64), so the match page names the players with closed DMs as it
 * does for manual reminders. A later pass of the same run (the attendance
 * offset, or the sign-up day) merges in: a player reached later is no
 * longer listed as missed.
 */
export const recordAutomatic = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        eventId: v.string(),
        kind: v.union(v.literal("signup"), v.literal("attendance")),
        runKey: v.string(),
        owner: v.optional(deliveryOwner),
        sentUserIds: v.array(v.string()),
        failedUserIds: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const eventId = ctx.db.normalizeId("events", args.eventId)
        const event = eventId ? await ctx.db.get(eventId) : null
        if (!event || event.guildId !== args.guildId) return null
        const runKey = args.runKey.trim().slice(0, 64)
        if (!runKey) return null
        const existing = await ctx.db
            .query("automaticReminderOutcomes")
            .withIndex("eventId_kind_runKey", (q) =>
                q
                    .eq("eventId", event._id)
                    .eq("kind", args.kind)
                    .eq("runKey", runKey)
            )
            .unique()
        const delivered = args.owner
            ? await ownerDeliverySummary(
                  ctx,
                  args.owner,
                  args.kind === "signup"
                      ? `signup:${runKey}`
                      : `attendance:${runKey.replace(/h$/, "")}`
              )
            : null
        if (
            delivered &&
            (delivered.guildId !== args.guildId ||
                delivered.eventId !== args.eventId)
        )
            throw new Error("Delivery scope mismatch")
        const row = {
            sentAt: new Date().toISOString(),
            ...mergeAutomaticReminderRun(
                existing,
                delivered
                    ? {
                          ...args,
                          sentUserIds: delivered.sent,
                          failedUserIds: delivered.refused,
                      }
                    : args
            ),
        }
        if (existing) await ctx.db.patch(existing._id, row)
        else
            await ctx.db.insert("automaticReminderOutcomes", {
                guildId: event.guildId,
                eventId: event._id,
                kind: args.kind,
                runKey,
                ...row,
            })
        return null
    },
})

/**
 * The newest finished reminder of a match, for the match page (board
 * L2-60..62, L2-64): a manual one with who sent it, or a scheduled one;
 * when, how many DMs arrived and who has their DMs closed. The Next server
 * reads it for a clan admin of the clan.
 */
export const latestOutcome = query({
    args: { secret: v.string(), guildId: v.string(), eventId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const eventId = ctx.db.normalizeId("events", args.eventId)
        const event = eventId ? await ctx.db.get(eventId) : null
        if (!event || event.guildId !== args.guildId) return null
        const [recent, automatic] = await Promise.all([
            ctx.db
                .query("eventReminderRequests")
                .withIndex("eventId_requestedAt", (q) =>
                    q.eq("eventId", event._id)
                )
                .order("desc")
                .take(10),
            ctx.db
                .query("automaticReminderOutcomes")
                .withIndex("eventId_sentAt", (q) => q.eq("eventId", event._id))
                .order("desc")
                .first(),
        ])
        const now = Date.now()
        const finished = recent.find(
            (row) =>
                (row.status === "sent" || row.status === "failed") &&
                now - Date.parse(row.completedAt ?? row.requestedAt) <
                    OUTCOME_WINDOW_MS
        )
        const finishedStatus =
            finished?.status === "sent" || finished?.status === "failed"
                ? finished.status
                : null
        return newestReminderOutcome(
            [
                finished && finishedStatus
                    ? {
                          automatic: false,
                          audience: finished.audience,
                          status: finishedStatus,
                          requestedAt: finished.requestedAt,
                          completedAt: finished.completedAt ?? null,
                          requestedBy: finished.requestedBy,
                          recipientCount: finished.recipientIds.length,
                          sentCount: finished.sentCount ?? 0,
                          failedUserIds: finished.failedUserIds ?? [],
                      }
                    : null,
                automatic ? automaticReminderOutcome(automatic) : null,
            ],
            now,
            OUTCOME_WINDOW_MS
        )
    },
})

export const fail = mutation({
    args: {
        secret: v.string(),
        requestId: v.string(),
        error: v.string(),
        claimToken: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        await finish(
            ctx,
            args.requestId,
            {
                status: "failed",
                error: args.error.slice(0, 500),
            },
            args.claimToken
        )
    },
})
