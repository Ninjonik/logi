import {
    query,
    mutation,
    type QueryCtx,
    type MutationCtx,
} from "./_generated/server"
import { base, context, guard, type Subject } from "./playerReportAccess"
import { internalMutation } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"

/**
 * The bot's side of "Nahlásit hráče" after the form: the panel's report
 * entry, the pending reports it polls every 30 s per clan and the ticket
 * delivery steps (claim, bind, complete, uncertain, release). The draft and
 * submission mutations, which validate with Zod, live in
 * `playerReportDrafts.ts`; the shared access checks in
 * `playerReportAccess.ts` (ARCHITECTURE.md, "Convex hot paths").
 */
export const entry = query({
    args: {
        ...base,
        panelId: v.id("discordPublicPanels"),
        revision: v.number(),
        channelId: v.string(),
    },
    handler: async (ctx, args) => {
        const value = await context(ctx, args)
        return value
            ? {
                  ...value.policy,
                  gameId: value.gameId,
                  language: value.config.defaultLanguage ?? "en",
              }
            : null
    },
})
const reportArgs = { ...base, reportId: v.id("playerReports") }
async function owned(
    ctx: Pick<QueryCtx, "db">,
    args: Subject & { reportId: Id<"playerReports"> }
) {
    guard(args)
    const report = await ctx.db.get(args.reportId)
    if (
        !report ||
        report.guildId !== args.guildId ||
        report.reporterId !== args.reporterId
    )
        throw new Error("Report unavailable.")
    return report
}
export const claim = mutation({
    args: reportArgs,
    handler: async (ctx, args) => {
        const report = await owned(ctx, args),
            now = Date.now()
        if (report.state === "open" || report.state === "closed")
            return { kind: "open" as const, threadId: report.threadId! }
        if (report.state === "blocked") return { kind: "blocked" as const }
        if (report.leaseUntil > now) return { kind: "busy" as const }
        const access = await context(ctx, { ...args, ...report })
        if (!access || access.policyJson !== report.policyJson) {
            await ctx.db.patch(report._id, {
                state: "blocked",
                leaseUntil: 0,
                updatedAt: now,
            })
            return { kind: "blocked" as const }
        }
        const canCreate = report.state === "pending",
            fence = report.fence + 1
        await ctx.db.patch(report._id, {
            state: "creating",
            fence,
            leaseUntil: now + 60_000,
            updatedAt: now,
        })
        return {
            kind: "claimed" as const,
            canCreate,
            fence,
            threadId: report.threadId ?? null,
            marker: `report-${report._id}`,
            reportNumber: report.reportNumber ?? null,
            language: access.config.defaultLanguage ?? "en",
            createdAt: report.createdAt,
            contextJson: report.contextJson,
            ...access.policy,
        }
    },
})
async function current(
    ctx: MutationCtx,
    args: Subject & { reportId: Id<"playerReports">; fence: number }
) {
    const report = await owned(ctx, args),
        access = await context(ctx, { ...args, ...report })
    if (
        !access ||
        access.policyJson !== report.policyJson ||
        report.fence !== args.fence ||
        report.leaseUntil <= Date.now() ||
        report.state !== "creating"
    )
        throw new Error("Report delivery changed.")
    return { report, access }
}
export const bind = mutation({
    args: { ...reportArgs, fence: v.number(), threadId: v.string() },
    handler: async (ctx, args) => {
        const { report } = await current(ctx, args)
        if (
            !/^\d{17,20}$/.test(args.threadId) ||
            (report.threadId && report.threadId !== args.threadId)
        )
            throw new Error("Report thread conflict.")
        await ctx.db.patch(report._id, {
            threadId: args.threadId,
            updatedAt: Date.now(),
        })
    },
})
export const complete = mutation({
    args: { ...reportArgs, fence: v.number(), messageId: v.string() },
    handler: async (ctx, args) => {
        const { report, access } = await current(ctx, args)
        if (!report.threadId || !/^\d{17,20}$/.test(args.messageId))
            throw new Error("Report is incomplete.")
        const existing = await ctx.db
            .query("ticketThreads")
            .withIndex("threadId", (q) => q.eq("threadId", report.threadId!))
            .unique()
        if (existing) throw new Error("Thread is already tracked.")
        // Older reports reserve their number only now.
        const number =
                report.reportNumber ?? (access.config.ticketCounter ?? 0) + 1,
            iso = new Date().toISOString(),
            contextValue = JSON.parse(report.contextJson) as { reason: string }
        const ticketId = await ctx.db.insert("ticketThreads", {
            guildId: args.guildId,
            threadId: report.threadId,
            parentChannelId: report.parentChannelId,
            creatorId: report.reporterId,
            categoryId: access.policy.categoryId,
            categoryLabel: access.policy.categoryLabel,
            ticketNumber: number,
            status: "open",
            transcriptMessageId: args.messageId,
            answers: [
                {
                    questionId: "report",
                    label: "Player report",
                    value: contextValue.reason,
                },
            ],
            openedAt: iso,
            createdAt: iso,
            updatedAt: iso,
        })
        if (report.reportNumber === undefined)
            await ctx.db.patch(access.config._id, { ticketCounter: number })
        await ctx.db.patch(report._id, {
            state: "open",
            ticketId,
            leaseUntil: 0,
            updatedAt: Date.now(),
        })
        return { threadId: report.threadId, ticketNumber: number }
    },
})
export const uncertain = mutation({
    args: { ...reportArgs, fence: v.number() },
    handler: async (ctx, args) => {
        const report = await owned(ctx, args)
        if (report.fence === args.fence && report.state === "creating")
            await ctx.db.patch(report._id, {
                state: "uncertain",
                leaseUntil: Date.now() + 30_000,
                updatedAt: Date.now(),
            })
    },
})
/** Nothing reached Discord yet: return the report to pending with a short backoff. */
export const release = mutation({
    args: { ...reportArgs, fence: v.number() },
    handler: async (ctx, args) => {
        const report = await owned(ctx, args)
        if (
            report.fence === args.fence &&
            report.state === "creating" &&
            !report.threadId
        )
            await ctx.db.patch(report._id, {
                state: "pending",
                leaseUntil: Date.now() + 30_000,
                updatedAt: Date.now(),
            })
    },
})
export const pending = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        guard({ ...args, reporterId: args.guildId })
        const rows = []
        for (const state of ["pending", "creating", "uncertain"] as const)
            rows.push(
                ...(await ctx.db
                    .query("playerReports")
                    .withIndex("guild_state_leaseUntil", (q) =>
                        q
                            .eq("guildId", args.guildId)
                            .eq("state", state)
                            .lte("leaseUntil", Date.now())
                    )
                    .take(10))
            )
        return rows
            .slice(0, 10)
            .map((r) => ({ reportId: r._id, reporterId: r.reporterId }))
    },
})
export const pruneDraft = internalMutation({
    args: { id: v.id("playerReportDrafts") },
    handler: async (ctx, args) => {
        const row = await ctx.db.get(args.id)
        if (row && row.expiresAt <= Date.now()) await ctx.db.delete(row._id)
    },
})
