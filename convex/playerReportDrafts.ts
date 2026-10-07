import {
    reportObservationSchema,
    reportSubmissionSchema,
    resolveReportPlayer,
} from "../src/domain/player-reports/report"
import { base, context, draftContext } from "./playerReportAccess"
import { mutation, query } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

/**
 * The report form of "Nahlásit hráče" (L3-58..68): the draft a picker
 * creates, what the form shows and the submission, all validated with Zod.
 * They live apart from `playerReports.ts`, whose `pending` the bot polls
 * every 30 s per clan (ARCHITECTURE.md, "Convex hot paths").
 */
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
