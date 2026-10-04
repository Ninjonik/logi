import {
    historyRetentionCutoff,
    historyRetentionSettingsSchema,
} from "../src/domain/game-data/history-retention"
import {
    internalMutation,
    mutation,
    query,
    type QueryCtx,
} from "./_generated/server"
import { dashboardActor, authorizeDashboardAdmin } from "./dashboardActor"
import { nextRevision } from "../src/domain/integrations/change"
import { appendIntegrationChange } from "./integrationChangeLog"
import { historyHead } from "./gameHistoryStore"
import { internal } from "./_generated/api"
import { v } from "convex/values"

const access = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}
/** Deleting is paced so one workspace cannot monopolise a transaction. */
const PRUNE_BATCH = 50

function settingsFor(ctx: Pick<QueryCtx, "db">, guildId: string) {
    return ctx.db
        .query("gameHistorySettings")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
}

export const read = query({
    args: access,
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const row = await settingsFor(ctx, args.guildId)
        return {
            retentionDays: row?.retentionDays ?? null,
            updatedAt: row?.updatedAt ?? null,
        }
    },
})

/** Dashboard-session configuration only; a shorter window starts pruning at once. */
export const configure = mutation({
    args: { ...access, retentionDays: v.union(v.number(), v.null()) },
    handler: async (ctx, args) => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        const settings = historyRetentionSettingsSchema.parse({
            retentionDays: args.retentionDays,
        })
        const existing = await settingsFor(ctx, args.guildId)
        const value = {
            ...settings,
            updatedAt: new Date().toISOString(),
            updatedBy: admin.session.subject,
        }
        if (existing) await ctx.db.patch(existing._id, value)
        else
            await ctx.db.insert("gameHistorySettings", {
                guildId: args.guildId,
                ...value,
            })
        if (settings.retentionDays !== null)
            await ctx.scheduler.runAfter(
                0,
                internal.gameHistoryRetention.prune,
                { guildId: args.guildId }
            )
        return settings
    },
})

/** Removes expired retained games in batches and advances the history revision so
 * consumers rebuild their totals instead of keeping deleted contributions. */
export const prune = internalMutation({
    args: { guildId: v.string() },
    handler: async (ctx, args) => {
        const cutoff = historyRetentionCutoff(
            await settingsFor(ctx, args.guildId),
            Date.now()
        )
        if (!cutoff) return { deleted: 0 }
        const rows = await ctx.db
            .query("serverGameHistory")
            .withIndex("guildId_endedAt", (q) =>
                q.eq("guildId", args.guildId).lt("endedAt", cutoff)
            )
            .take(PRUNE_BATCH)
        for (const row of rows) {
            await ctx.db.delete(row._id)
            await appendIntegrationChange(ctx, {
                guildId: args.guildId,
                gameId: "wardogs",
                resource: "server-game-history",
                id: String(row._id),
                operation: "remove",
            })
        }
        if (rows.length) {
            const head = await historyHead(ctx, args.guildId)
            if (head)
                await ctx.db.patch(head._id, {
                    revision: nextRevision(head.revision),
                })
            else
                await ctx.db.insert("serverGameHistoryHeads", {
                    guildId: args.guildId,
                    revision: nextRevision("0"),
                    lastCollectedAt: new Date().toISOString(),
                })
        }
        if (rows.length === PRUNE_BATCH)
            await ctx.scheduler.runAfter(
                0,
                internal.gameHistoryRetention.prune,
                { guildId: args.guildId }
            )
        return { deleted: rows.length }
    },
})

export const pruneDue = internalMutation({
    args: {},
    handler: async (ctx) => {
        const rows = await ctx.db.query("gameHistorySettings").take(500)
        for (const row of rows)
            if (row.retentionDays !== null)
                await ctx.scheduler.runAfter(
                    0,
                    internal.gameHistoryRetention.prune,
                    { guildId: row.guildId }
                )
    },
})
