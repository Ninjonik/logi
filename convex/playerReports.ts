import {
    reportObservationSchema,
    reportSubmissionSchema,
    resolveReportPlayer,
} from "../src/domain/player-reports/report"
import {
    isPanelPaused,
    normalizePanelKind,
} from "../src/domain/discord-publications/settings"
import {
    query,
    mutation,
    type QueryCtx,
    type MutationCtx,
} from "./_generated/server"
import { internalMutation } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import { connectionSource } from "./gameDataCatalog"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"

const base = { secret: v.string(), guildId: v.string(), reporterId: v.string() }
type Subject = { secret: string; guildId: string; reporterId: string }
function guard(args: Subject) {
    if (
        !process.env.INTERNAL_AUTH_SECRET ||
        args.secret !== process.env.INTERNAL_AUTH_SECRET ||
        !/^\d{17,20}$/.test(args.guildId) ||
        !/^\d{17,20}$/.test(args.reporterId)
    )
        throw new Error("Unauthorized.")
}
async function context(
    ctx: Pick<QueryCtx, "db">,
    args: Subject & {
        panelId: Id<"discordPublicPanels">
        revision: number
        channelId: string
    }
) {
    guard(args)
    const panel = await ctx.db.get(args.panelId)
    if (
        !panel ||
        isPanelPaused(panel) ||
        panel.draft ||
        panel.removing ||
        normalizePanelKind(panel.kind) !== "server" ||
        !panel.connectionId ||
        panel.guildId !== args.guildId ||
        panel.revision !== args.revision ||
        panel.channelId !== args.channelId ||
        !panel.reportCategoryId
    )
        return null
    const config = await ctx.db
        .query("discordConfigs")
        .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
        .unique()
    const settings = config?.ticketSettings,
        category = settings?.categories.find(
            (c) => c.id === panel.reportCategoryId
        )
    if (!settings?.enabled || !settings.ticketParentChannelId || !category)
        return null
    const id = ctx.db.normalizeId("gameDataConnections", panel.connectionId),
        connection = id ? await ctx.db.get(id) : null
    if (
        !connection?.enabled ||
        connection.guildId !== args.guildId ||
        !["hll_crcon", "wardogs_warcon"].includes(connection.provider)
    )
        return null
    const source = await connectionSource(ctx, connection)
    if (!source) return null
    const policy = {
        guildId: args.guildId,
        panelId: panel._id,
        revision: panel.revision,
        channelId: panel.channelId,
        connectionId: connection._id,
        generation: connection.generation,
        sourceFingerprint: connection.sourceFingerprint,
        parentChannelId: settings.ticketParentChannelId,
        categoryId: category.id,
        categoryLabel: category.label || category.id,
        supportRoleIds: category.supportRoleIds,
        dashboardAdminRoleId: config?.dashboardAdminRoleId ?? null,
    }
    return {
        panel,
        config: config!,
        policy,
        gameId: connection.gameId,
        policyJson: JSON.stringify(policy),
    }
}
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
export const createDraft = mutation({
    args: {
        ...base,
        panelId: v.id("discordPublicPanels"),
        revision: v.number(),
        channelId: v.string(),
        observationJson: v.string(),
        interactionId: v.string(),
    },
    handler: async (ctx, args) => {
        const access = await context(ctx, args)
        if (!access) throw new Error("Reporting configuration changed.")
        if (
            args.observationJson.length > 180_000 ||
            !/^\d{17,20}$/.test(args.interactionId)
        )
            throw new Error("Invalid report draft.")
        const observation = reportObservationSchema.parse(
                JSON.parse(args.observationJson)
            ),
            now = Date.now()
        if (
            observation.players.length &&
            (!observation.observedAt ||
                Date.parse(observation.observedAt) > now + 5000 ||
                now - Date.parse(observation.observedAt) > 60_000)
        )
            throw new Error("Player observation expired.")
        const existing = await ctx.db
            .query("playerReportDrafts")
            .withIndex("interactionId", (q) =>
                q.eq("interactionId", args.interactionId)
            )
            .unique()
        if (existing) {
            if (
                existing.guildId !== args.guildId ||
                existing.reporterId !== args.reporterId
            )
                throw new Error("Unauthorized.")
            return String(existing._id)
        }
        const pending = await ctx.db
            .query("playerReportDrafts")
            .withIndex("guild_reporter", (q) =>
                q.eq("guildId", args.guildId).eq("reporterId", args.reporterId)
            )
            .take(20)
        if (pending.filter((d) => d.expiresAt > now).length >= 5)
            throw new Error("Too many report forms. Retry in 15 minutes.")
        const id = await ctx.db.insert("playerReportDrafts", {
            guildId: args.guildId,
            reporterId: args.reporterId,
            panelId: args.panelId,
            revision: args.revision,
            channelId: args.channelId,
            interactionId: args.interactionId,
            policyJson: access.policyJson,
            observationJson: JSON.stringify(observation),
            expiresAt: now + 900_000,
        })
        await ctx.scheduler.runAfter(
            900_000,
            makeFunctionReference<"mutation">("playerReports:pruneDraft"),
            { id }
        )
        return String(id)
    },
})
async function draftContext(
    ctx: Pick<QueryCtx, "db">,
    args: Subject & { draftId: Id<"playerReportDrafts"> }
) {
    guard(args)
    const draft = await ctx.db.get(args.draftId)
    if (
        !draft ||
        draft.guildId !== args.guildId ||
        draft.reporterId !== args.reporterId ||
        draft.expiresAt <= Date.now()
    )
        return null
    const access = await context(ctx, { ...args, ...draft })
    return access && access.policyJson === draft.policyJson
        ? { draft, access }
        : null
}
export const draft = query({
    args: { ...base, draftId: v.id("playerReportDrafts") },
    handler: async (ctx, args) => {
        const value = await draftContext(ctx, args)
        return value
            ? {
                  ...value.access.policy,
                  gameId: value.access.gameId,
                  observation: reportObservationSchema.parse(
                      JSON.parse(value.draft.observationJson)
                  ),
              }
            : null
    },
})
export const submit = mutation({
    args: {
        ...base,
        draftId: v.id("playerReportDrafts"),
        submissionJson: v.string(),
    },
    handler: async (ctx, args) => {
        const value = await draftContext(ctx, args)
        if (!value) throw new Error("Report expired or configuration changed.")
        const old = await ctx.db
            .query("playerReports")
            .withIndex("draftId", (q) => q.eq("draftId", args.draftId))
            .unique()
        if (old) return String(old._id)
        if (args.submissionJson.length > 6000)
            throw new Error("Report is too long.")
        const input = reportSubmissionSchema.parse(
                JSON.parse(args.submissionJson)
            ),
            observation = reportObservationSchema.parse(
                JSON.parse(value.draft.observationJson)
            ),
            player = resolveReportPlayer(observation, input),
            now = Date.now()
        const recent = await ctx.db
            .query("playerReports")
            .withIndex("guild_reporter_createdAt", (q) =>
                q.eq("guildId", args.guildId).eq("reporterId", args.reporterId)
            )
            .order("desc")
            .take(10)
        if (recent[0] && now - recent[0].createdAt < 60_000)
            throw new Error("Wait one minute before sending another report.")
        let active = 0
        for (const state of [
            "pending",
            "creating",
            "uncertain",
            "open",
        ] as const)
            active += (
                await ctx.db
                    .query("playerReports")
                    .withIndex("guild_reporter_state", (q) =>
                        q
                            .eq("guildId", args.guildId)
                            .eq("reporterId", args.reporterId)
                            .eq("state", state)
                    )
                    .take(3)
            ).length
        if (active >= 3)
            throw new Error(
                "Three reports are already open. Use the existing private tickets."
            )
        // Reserve the ticket number now: the thread is named by it (L3-68).
        const reportNumber = (value.access.config.ticketCounter ?? 0) + 1
        await ctx.db.patch(value.access.config._id, {
            ticketCounter: reportNumber,
        })
        return String(
            await ctx.db.insert("playerReports", {
                guildId: args.guildId,
                reporterId: args.reporterId,
                reportNumber,
                draftId: args.draftId,
                panelId: value.draft.panelId,
                revision: value.draft.revision,
                channelId: value.draft.channelId,
                policyJson: value.draft.policyJson,
                contextJson: JSON.stringify({
                    gameId: value.access.gameId,
                    connectionId: value.access.policy.connectionId,
                    serverName: observation.serverName,
                    map: observation.map,
                    observedAt: observation.observedAt,
                    player,
                    reason: input.reason,
                    incident: input.incident,
                    evidence: input.evidence,
                }),
                parentChannelId: value.access.policy.parentChannelId,
                state: "pending",
                createdAt: now,
                updatedAt: now,
                fence: 0,
                leaseUntil: 0,
            })
        )
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
