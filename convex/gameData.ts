import {
    observationSchema,
    type ClaimedConnection,
    type DataSource,
} from "../src/domain/game-data/contracts"
import {
    acceptsRun,
    parseSources,
    projectHealth,
    projectSnapshot,
} from "../src/domain/game-data/policy"
import { gameDataError, gameDataObservation } from "./gameDataValidators"
import { mutation, internalMutation } from "./integrationMutation"
import { resetHistory } from "./gameDataHistory"
import { query } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"

function assertSecret(secret: string) {
    if (
        !process.env.INTERNAL_AUTH_SECRET ||
        secret !== process.env.INTERNAL_AUTH_SECRET
    )
        throw new Error("Unauthorized.")
}
function sources() {
    return parseSources(process.env.LOGI_GAME_DATA_SOURCES)
}
function fingerprint(source: DataSource) {
    return JSON.stringify(source)
}

export const configure = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        sourceRef: v.string(),
        enabled: v.boolean(),
    },
    handler: async (ctx, args): Promise<string> => {
        assertSecret(args.secret)
        const source = sources().find(
            (value) =>
                value.ref === args.sourceRef && value.guildId === args.guildId
        )
        const existing = await ctx.db
            .query("gameDataConnections")
            .withIndex("sourceRef", (q) => q.eq("sourceRef", args.sourceRef))
            .unique()
        if (
            (!source && args.enabled) ||
            (existing && existing.guildId !== args.guildId) ||
            (!source && !existing)
        )
            throw new Error("Configured source not found.")
        if (
            source &&
            existing &&
            (existing.gameId !== source.gameId ||
                existing.provider !== source.provider ||
                existing.providerServerId !== source.providerServerId)
        )
            throw new Error(
                "Use a new source reference for a different provider identity."
            )
        const now = Date.now()
        const state = {
            enabled: args.enabled,
            generation: (existing?.generation ?? 0) + 1,
            leaseUntil: 0,
            attempt: 0,
            nextAttemptAt: args.enabled ? now : null,
            errorCategory: null,
            updatedAt: new Date(now).toISOString(),
            pollAfterMs: 60_000,
        }
        if (existing) {
            await ctx.db.patch(existing._id, {
                ...state,
                ...(source ? { sourceFingerprint: fingerprint(source) } : {}),
                etag: null,
            })
            if (["hll_crcon", "wardogs_warcon"].includes(existing.provider))
                await resetHistory(ctx, existing._id, args.enabled)
            if (args.enabled)
                await ctx.scheduler.runAfter(
                    0,
                    internal.gameDataCollector.collectDue,
                    {}
                )
            return String(existing._id)
        }
        if (!source) throw new Error("Configured source not found.")
        const id = await ctx.db.insert("gameDataConnections", {
            ...state,
            sourceRef: source.ref,
            guildId: source.guildId,
            gameId: source.gameId,
            provider: source.provider,
            providerServerId: source.providerServerId,
            sourceFingerprint: fingerprint(source),
            fence: 0,
            lastAttemptAt: null,
            observation: null,
            etag: null,
            createdAt: state.updatedAt,
        })
        if (["hll_crcon", "wardogs_warcon"].includes(source.provider))
            await resetHistory(ctx, id, args.enabled)
        if (args.enabled)
            await ctx.scheduler.runAfter(
                0,
                internal.gameDataCollector.collectDue,
                {}
            )
        return String(id)
    },
})

export const listConnections = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const configured = sources().filter(
            (source) => source.guildId === args.guildId
        )
        const rows = await ctx.db
            .query("gameDataConnections")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .collect()
        const result = rows.map((row) => ({
            sourceRef: row.sourceRef,
            configured: configured.some(
                (source) => source.ref === row.sourceRef
            ),
            snapshot: projectSnapshot(
                { ...row, id: String(row._id) },
                Date.now()
            ),
            health: projectHealth({ ...row, id: String(row._id) }, Date.now()),
        }))
        return {
            sources: configured.map(({ ref, gameId, provider }) => ({
                ref,
                gameId,
                provider,
            })),
            connections: result,
        }
    },
})

export const claimNext = internalMutation({
    args: {},
    handler: async (ctx): Promise<ClaimedConnection | null> => {
        const now = Date.now()
        const due = await ctx.db
            .query("gameDataConnections")
            .withIndex("nextAttemptAt", (q) =>
                q.gte("nextAttemptAt", 0).lte("nextAttemptAt", now)
            )
            .take(10)
        const catalog = sources()
        for (const row of due) {
            if (!row.enabled || row.leaseUntil > now) continue
            const source = catalog.find(
                (value) =>
                    value.ref === row.sourceRef && value.guildId === row.guildId
            )
            if (!source || fingerprint(source) !== row.sourceFingerprint) {
                await ctx.db.patch(row._id, {
                    errorCategory: "configuration",
                    nextAttemptAt: null,
                    updatedAt: new Date(now).toISOString(),
                })
                continue
            }
            const fence = row.fence + 1
            const attempt = row.attempt >= 3 ? 1 : row.attempt + 1
            await ctx.db.patch(row._id, {
                fence,
                attempt,
                leaseUntil: now + 60_000,
                nextAttemptAt: now + 60_000,
                lastAttemptAt: new Date(now).toISOString(),
                updatedAt: new Date(now).toISOString(),
            })
            return {
                ...source,
                id: String(row._id),
                generation: row.generation,
                fence,
                attempt,
                observation: row.observation,
                etag: row.etag,
                pollAfterMs: row.pollAfterMs,
            }
        }
        return null
    },
})

export const finishSnapshot = internalMutation({
    args: {
        id: v.id("gameDataConnections"),
        generation: v.number(),
        fence: v.number(),
        result: v.object({
            observation: v.optional(gameDataObservation),
            etag: v.optional(v.union(v.string(), v.null())),
            pollAfterMs: v.optional(v.number()),
            errorCategory: v.union(gameDataError, v.null()),
            nextAttemptAt: v.union(v.number(), v.null()),
        }),
    },
    handler: async (ctx, args): Promise<boolean> => {
        const row = await ctx.db.get(args.id)
        const now = Date.now()
        if (!row || !acceptsRun(row, args, now)) return false
        const source = sources().find(
            (value) =>
                value.ref === row.sourceRef && value.guildId === row.guildId
        )
        if (!source || fingerprint(source) !== row.sourceFingerprint)
            return false
        const observation =
            args.result.observation === undefined
                ? undefined
                : observationSchema.parse(args.result.observation)
        if (observation && Date.parse(observation.observedAt) > now)
            throw new Error("Invalid observation time.")
        await ctx.db.patch(row._id, {
            ...args.result,
            ...(observation ? { observation } : {}),
            leaseUntil: 0,
            ...(!args.result.errorCategory ? { attempt: 0 } : {}),
            updatedAt: new Date(now).toISOString(),
        })
        if (args.result.nextAttemptAt !== null)
            await ctx.scheduler.runAfter(
                Math.max(0, args.result.nextAttemptAt - now),
                internal.gameDataCollector.collectDue,
                {}
            )
        return true
    },
})
