import {
    matchHistoryExpired,
    retentionCutoffs,
    seedCallPending,
    type RetentionCutoffs,
} from "../src/domain/housekeeping/retention"
import { internalMutation, type MutationCtx } from "./_generated/server"
import { deleteWebhookDeliveries } from "./webhookDeliveryCleanup"
import type { Doc, Id, TableNames } from "./_generated/dataModel"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

/**
 * Daily retention of the tables that gain a row per request, run or change
 * and had nothing that removed them (ARCHITECTURE.md, "Convex hot paths";
 * windows in `src/domain/housekeeping/retention.ts`). Each table is read
 * through an index bounded by its cutoff, about 250 rows per table and
 * transaction, and the mutation reschedules itself while a batch was full
 * and deleted something. A small module of its own, so the cron evaluates
 * no Zod.
 */
const BATCH = 250

type Ctx = Pick<MutationCtx, "db">
type Pass = { deleted: number; more: boolean }

/**
 * A full page that deleted rows may have more behind it. A full page whose
 * rows all had to stay is no progress, and rescheduling would read it again
 * at once, so it waits for the next day.
 */
const pass = (read: number, deleted: number): Pass => ({
    deleted,
    more: read >= BATCH && deleted > 0,
})

async function deleteRows<Table extends TableNames>(
    ctx: Ctx,
    rows: Array<{ _id: Id<Table> }>
) {
    for (const row of rows) await ctx.db.delete(row._id)
    return rows.length
}

/** Delivered or failed deliveries whose last attempt is past the window. */
async function webhookDeliveries(ctx: Ctx, cutoffs: RetentionCutoffs) {
    let read = 0
    let deleted = 0
    for (const status of ["delivered", "failed"] as const) {
        if (read >= BATCH) break
        const rows = await ctx.db
            .query("webhookDeliveries")
            .withIndex("status_nextAttemptAt", (q) =>
                q.eq("status", status).lt("nextAttemptAt", cutoffs.history)
            )
            .take(BATCH - read)
        read += rows.length
        deleted += await deleteRows(ctx, rows)
    }
    return pass(read, deleted)
}

/** Replay receipts of website event commands; the replay window is 30 days. */
async function websiteEventCommandReceipts(
    ctx: Ctx,
    cutoffs: RetentionCutoffs
) {
    const rows = await ctx.db
        .query("websiteEventCommandReceipts")
        .withIndex("createdAt", (q) => q.lt("createdAt", cutoffs.historyIso))
        .take(BATCH)
    return pass(rows.length, await deleteRows(ctx, rows))
}

/** Manual reminders; the match page shows 7 days, the cool-down is an hour. */
async function eventReminderRequests(ctx: Ctx, cutoffs: RetentionCutoffs) {
    const rows = await ctx.db
        .query("eventReminderRequests")
        .withIndex("requestedAt", (q) =>
            q.lt("requestedAt", cutoffs.historyIso)
        )
        .take(BATCH)
    return pass(rows.length, await deleteRows(ctx, rows))
}

/** Scheduled reminders' outcomes; the match page shows 7 days. */
async function automaticReminderOutcomes(ctx: Ctx, cutoffs: RetentionCutoffs) {
    const rows = await ctx.db
        .query("automaticReminderOutcomes")
        .withIndex("sentAt", (q) => q.lt("sentAt", cutoffs.historyIso))
        .take(BATCH)
    return pass(rows.length, await deleteRows(ctx, rows))
}

/** A request expires 15 s after it was made; it is kept a day after. */
async function meetingAttendanceRequests(ctx: Ctx, cutoffs: RetentionCutoffs) {
    const rows = await ctx.db
        .query("meetingAttendanceRequests")
        .withIndex("expiresAt", (q) => q.lt("expiresAt", cutoffs.requestIso))
        .take(BATCH)
    return pass(rows.length, await deleteRows(ctx, rows))
}

/** A challenge expires 10 min after it began; it is kept a day after. */
async function platformLinkChallenges(ctx: Ctx, cutoffs: RetentionCutoffs) {
    const rows = await ctx.db
        .query("platformLinkChallenges")
        .withIndex("expiresAt", (q) => q.lt("expiresAt", cutoffs.request))
        .take(BATCH)
    return pass(rows.length, await deleteRows(ctx, rows))
}

/**
 * Ended seed runs that started before the window (the seed history shows 30
 * days), with their call's outbox row. A run whose last call state the bot
 * has not delivered yet stays with its row: `discordSeedBot:deliveryState`
 * draws that call from the run.
 */
async function discordSeedRuns(ctx: Ctx, cutoffs: RetentionCutoffs) {
    let read = 0
    let deleted = 0
    for (const status of [
        "live",
        "ended_timeout",
        "ended_admin",
        "failed",
    ] as const) {
        if (read >= BATCH) break
        const runs = await ctx.db
            .query("discordSeedRuns")
            .withIndex("status_startedAt", (q) =>
                q.eq("status", status).lt("startedAt", cutoffs.history)
            )
            .take(BATCH - read)
        read += runs.length
        for (const run of runs) {
            const outbox = await ctx.db
                .query("discordSeedMessages")
                .withIndex("guild_kind_key", (q) =>
                    q
                        .eq("guildId", run.guildId)
                        .eq("kind", "call")
                        .eq("key", String(run._id))
                )
                .first()
            if (seedCallPending(outbox)) continue
            if (outbox) await ctx.db.delete(outbox._id)
            await ctx.db.delete(run._id)
            deleted++
        }
    }
    return pass(read, deleted)
}

type EventLookup = (id: Id<"events">) => Promise<Doc<"events"> | null>

function eventLookup(ctx: Ctx): EventLookup {
    const cache = new Map<string, Promise<Doc<"events"> | null>>()
    return (id) => {
        let event = cache.get(id)
        if (!event) {
            event = ctx.db.get(id)
            cache.set(id, event)
        }
        return event
    }
}

/** Sign-up activity of matches that ended before the window. */
async function signupActivities(
    ctx: Ctx,
    cutoffs: RetentionCutoffs,
    event: EventLookup
) {
    const rows = await ctx.db
        .query("signupActivities")
        .withIndex("occurredAt", (q) => q.lt("occurredAt", cutoffs.historyIso))
        .take(BATCH)
    let deleted = 0
    for (const row of rows)
        if (matchHistoryExpired(await event(row.eventId), cutoffs.history)) {
            await ctx.db.delete(row._id)
            deleted++
        }
    return pass(rows.length, deleted)
}

/**
 * Finished change requests of matches that ended before the window; an
 * upcoming match keeps its digest baseline (`rosterChanges:claim`).
 */
async function rosterChangeRequests(
    ctx: Ctx,
    cutoffs: RetentionCutoffs,
    event: EventLookup
) {
    let read = 0
    let deleted = 0
    for (const status of ["sent", "failed"] as const) {
        if (read >= BATCH) break
        const rows = await ctx.db
            .query("rosterChangeRequests")
            .withIndex("status_requestedAt", (q) =>
                q.eq("status", status).lt("requestedAt", cutoffs.historyIso)
            )
            .take(BATCH - read)
        read += rows.length
        for (const row of rows)
            if (
                matchHistoryExpired(await event(row.eventId), cutoffs.history)
            ) {
                await ctx.db.delete(row._id)
                deleted++
            }
    }
    return pass(read, deleted)
}

/**
 * League message references stored before they got an expiry. New ones
 * expire 14 days after they were posted and `leagueDiscoveryQueue:
 * pruneReferences` removes them; these never would.
 */
async function leagueMessageRefs(ctx: Ctx, cutoffs: RetentionCutoffs) {
    const rows = await ctx.db
        .query("leagueMessageRefs")
        .withIndex("expiresAt", (q) =>
            q
                .eq("expiresAt", undefined)
                .lt("_creationTime", cutoffs.leagueMessageRef)
        )
        .take(BATCH)
    return pass(rows.length, await deleteRows(ctx, rows))
}

export const pruneHistory = internalMutation({
    args: {},
    handler: async (ctx) => {
        const cutoffs = retentionCutoffs(Date.now())
        const event = eventLookup(ctx)
        const passes: Record<string, Pass> = {
            webhookDeliveries: await webhookDeliveries(ctx, cutoffs),
            websiteEventCommandReceipts: await websiteEventCommandReceipts(
                ctx,
                cutoffs
            ),
            eventReminderRequests: await eventReminderRequests(ctx, cutoffs),
            automaticReminderOutcomes: await automaticReminderOutcomes(
                ctx,
                cutoffs
            ),
            meetingAttendanceRequests: await meetingAttendanceRequests(
                ctx,
                cutoffs
            ),
            platformLinkChallenges: await platformLinkChallenges(ctx, cutoffs),
            discordSeedRuns: await discordSeedRuns(ctx, cutoffs),
            signupActivities: await signupActivities(ctx, cutoffs, event),
            rosterChangeRequests: await rosterChangeRequests(
                ctx,
                cutoffs,
                event
            ),
            leagueMessageRefs: await leagueMessageRefs(ctx, cutoffs),
        }
        const more = Object.values(passes).some((item) => item.more)
        if (more)
            await ctx.scheduler.runAfter(
                0,
                makeFunctionReference<"mutation">("housekeeping:pruneHistory"),
                {}
            )
        const deleted: Record<string, number> = {}
        for (const [table, item] of Object.entries(passes))
            deleted[table] = item.deleted
        return { deleted, more }
    },
})

/** The next batch of a removed webhook subscription's deliveries. */
export const removeWebhookDeliveries = internalMutation({
    args: { webhookId: v.id("webhookSubscriptions") },
    handler: async (ctx, args) =>
        await deleteWebhookDeliveries(ctx, args.webhookId),
})
