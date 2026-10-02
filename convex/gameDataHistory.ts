import {
    gameDataError,
    gameDataSession,
    gameDataHistoryProgress,
} from "./gameDataValidators"
import {
    providerSessionSchema,
    type DataSource,
} from "../src/domain/game-data/contracts"
import type { HistoryProgress } from "../src/application/game-data/collect-sessions"
import { parseSources } from "../src/domain/game-data/policy"
import { internalMutation } from "./integrationMutation"
import { type MutationCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import { z } from "zod"

export async function resetHistory(
    ctx: MutationCtx,
    id: Id<"gameDataConnections">,
    enabled: boolean
): Promise<void> {
    const existing = await ctx.db
        .query("gameDataHistoryRuns")
        .withIndex("connectionId", (q) => q.eq("connectionId", id))
        .unique()
    const state = {
        progress: { page: 1, pendingIds: [], nextPage: null },
        leaseUntil: 0,
        attempt: 0,
        nextAttemptAt: enabled ? Date.now() : null,
        errorCategory: null,
        lastWasRevisit: false,
    }
    if (existing) await ctx.db.patch(existing._id, state)
    else
        await ctx.db.insert("gameDataHistoryRuns", {
            ...state,
            connectionId: id,
            fence: 0,
            lastSuccessAt: null,
            lastCompletedAt: null,
        })
    if (enabled)
        await ctx.scheduler.runAfter(
            0,
            internal.gameDataCollector.collectHistoryDue,
            {}
        )
}
type Claim = {
    runId: Id<"gameDataHistoryRuns">
    generation: number
    fence: number
    attempt: number
    connection: DataSource
    progress: HistoryProgress
    revisitId: string | null
}
export const claimNext = internalMutation({
    args: {},
    handler: async (ctx): Promise<Claim | null> => {
        const now = Date.now()
        const rows = await ctx.db
            .query("gameDataHistoryRuns")
            .withIndex("nextAttemptAt", (q) =>
                q.gte("nextAttemptAt", 0).lte("nextAttemptAt", now)
            )
            .take(10)
        const catalog = parseSources(process.env.LOGI_GAME_DATA_SOURCES)
        for (const row of rows) {
            if (row.leaseUntil > now) continue
            const connection = await ctx.db.get(row.connectionId)
            const source =
                connection &&
                catalog.find(
                    (entry) =>
                        entry.ref === connection.sourceRef &&
                        entry.guildId === connection.guildId
                )
            if (
                !connection?.enabled ||
                !source ||
                !["hll_crcon", "wardogs_warcon"].includes(source.provider) ||
                JSON.stringify(source) !== connection.sourceFingerprint
            ) {
                await ctx.db.patch(row._id, {
                    errorCategory: "configuration",
                    nextAttemptAt: null,
                })
                continue
            }
            const fence = row.fence + 1
            const progress =
                row.leaseUntil > 0 && row.progress.pendingIds.length === 0
                    ? {
                          ...row.progress,
                          page: Math.max(1, row.progress.page - 1),
                      }
                    : row.progress
            const unfinished = row.lastWasRevisit
                ? null
                : await ctx.db
                      .query("gameSessions")
                      .withIndex("connection_complete_fetched", (q) =>
                          q
                              .eq("connectionId", row.connectionId)
                              .eq("complete", false)
                              .lte("fetchedAt", now - 300_000)
                      )
                      .first()
            const attempt = row.attempt >= 3 ? 1 : row.attempt + 1
            await ctx.db.patch(row._id, {
                fence,
                progress,
                attempt,
                leaseUntil: now + 60_000,
                nextAttemptAt: now + 60_000,
            })
            return {
                runId: row._id,
                generation: connection.generation,
                fence,
                attempt,
                connection: source,
                progress,
                revisitId: unfinished?.externalId ?? null,
            }
        }
        return null
    },
})
const runArgs = {
    runId: v.id("gameDataHistoryRuns"),
    generation: v.number(),
    fence: v.number(),
}
async function currentRun(
    ctx: MutationCtx,
    args: {
        runId: Id<"gameDataHistoryRuns">
        generation: number
        fence: number
    }
) {
    const row = await ctx.db.get(args.runId)
    if (!row || row.fence !== args.fence || row.leaseUntil <= Date.now())
        return null
    const connection = await ctx.db.get(row.connectionId)
    if (
        !connection?.enabled ||
        connection.generation !== args.generation ||
        !["hll_crcon", "wardogs_warcon"].includes(connection.provider)
    )
        return null
    const source = parseSources(process.env.LOGI_GAME_DATA_SOURCES).find(
        (entry) =>
            entry.ref === connection.sourceRef &&
            entry.guildId === connection.guildId
    )
    if (!source || JSON.stringify(source) !== connection.sourceFingerprint)
        return null
    return { row, connection }
}
const progressSchema = z.strictObject({
    page: z.number().int().min(1).max(1_000_000),
    pendingIds: z.array(z.string().regex(/^\d{1,20}$/)).max(50),
    nextPage: z.number().int().min(1).max(1_000_000).nullable(),
})
export const commit = internalMutation({
    args: {
        ...runArgs,
        result: v.object({
            session: v.union(gameDataSession, v.null()),
            progress: gameDataHistoryProgress,
            completed: v.boolean(),
            revisit: v.optional(v.boolean()),
        }),
    },
    handler: async (ctx, args): Promise<boolean> => {
        const current = await currentRun(ctx, args)
        if (!current) return false
        const { row, connection } = current
        const progress = progressSchema.parse(args.result.progress)
        const now = Date.now()
        const updatedAt = new Date(now).toISOString()
        let count = connection.historyCount ?? 0
        if (args.result.session) {
            const session = providerSessionSchema.parse(args.result.session)
            const existing = await ctx.db
                .query("gameSessions")
                .withIndex("connection_external", (q) =>
                    q
                        .eq("connectionId", row.connectionId)
                        .eq("externalId", session.externalId)
                )
                .unique()
            const record = {
                session,
                complete: session.complete,
                fetchedAt: now,
                updatedAt,
            }
            if (existing) await ctx.db.patch(existing._id, record)
            else {
                await ctx.db.insert("gameSessions", {
                    ...record,
                    connectionId: row.connectionId,
                    guildId: connection.guildId,
                    gameId: connection.gameId,
                    externalId: session.externalId,
                })
                count++
            }
        }
        await ctx.db.patch(row._id, {
            progress,
            leaseUntil: 0,
            attempt: 0,
            errorCategory: null,
            lastSuccessAt: updatedAt,
            lastWasRevisit: args.result.revisit ?? false,
            ...(args.result.completed ? { lastCompletedAt: updatedAt } : {}),
            nextAttemptAt: now + (args.result.completed ? 300_000 : 1_000),
        })
        await ctx.db.patch(connection._id, {
            historyCount: count,
            historyLastSuccessAt: updatedAt,
            historyErrorCategory: null,
            updatedAt,
        })
        await ctx.scheduler.runAfter(
            args.result.completed ? 300_000 : 1_000,
            internal.gameDataCollector.collectHistoryDue,
            {}
        )
        return true
    },
})
export const fail = internalMutation({
    args: {
        ...runArgs,
        errorCategory: gameDataError,
        nextAttemptAt: v.union(v.number(), v.null()),
    },
    handler: async (ctx, args): Promise<boolean> => {
        const current = await currentRun(ctx, args)
        if (!current) return false
        await ctx.db.patch(current.row._id, {
            leaseUntil: 0,
            errorCategory: args.errorCategory,
            nextAttemptAt: args.nextAttemptAt,
        })
        await ctx.db.patch(current.connection._id, {
            historyErrorCategory: args.errorCategory,
            updatedAt: new Date().toISOString(),
        })
        if (args.nextAttemptAt !== null)
            await ctx.scheduler.runAfter(
                Math.max(0, args.nextAttemptAt - Date.now()),
                internal.gameDataCollector.collectHistoryDue,
                {}
            )
        return true
    },
})
