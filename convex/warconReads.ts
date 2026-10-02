import {
    warconQuerySchema,
    warconCacheMs,
} from "../src/domain/game-data/warcon-query"
import {
    allowsApiKeyRead,
    isApiKeyReadAccess,
} from "../src/domain/api/key-access"
import { warconEnvelopeSchema } from "../src/domain/game-data/warcon-contracts"
import type { WarconPrepared } from "../src/application/game-data/read-warcon"
import { internalMutation, type MutationCtx } from "./_generated/server"
import { parseSources } from "../src/domain/game-data/policy"
import { makeFunctionReference } from "convex/server"
import { gameDataError } from "./gameDataValidators"
import { v } from "convex/values"

const accessArgs = {
    secret: v.string(),
    guildId: v.string(),
    connectionId: v.string(),
    keyHash: v.optional(v.string()),
    queryJson: v.string(),
}
type Access = {
    secret: string
    guildId: string
    connectionId: string
    keyHash?: string
    queryJson: string
}
async function authorize(ctx: MutationCtx, args: Access) {
    if (
        !process.env.INTERNAL_AUTH_SECRET ||
        args.secret !== process.env.INTERNAL_AUTH_SECRET
    )
        throw new Error("Unauthorized.")
    if (args.queryJson.length > 1500) throw new Error("Invalid Warcon query.")
    const input = warconQuerySchema.parse(JSON.parse(args.queryJson))
    if (args.keyHash !== undefined) {
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash!))
            .unique()
        if (
            !key ||
            key.revokedAt ||
            key.guildId !== args.guildId ||
            !isApiKeyReadAccess(key.readAccess) ||
            !allowsApiKeyRead(key.readAccess, "warcon-data", "wardogs")
        )
            return null
    }
    const id = ctx.db.normalizeId("gameDataConnections", args.connectionId)
    const row = id ? await ctx.db.get(id) : null
    if (
        !row?.enabled ||
        row.guildId !== args.guildId ||
        row.provider !== "wardogs_warcon" ||
        row.gameId !== "wardogs"
    )
        return null
    const source = parseSources(process.env.LOGI_GAME_DATA_SOURCES).find(
        (s) => s.ref === row.sourceRef && s.guildId === args.guildId
    )
    if (
        !source ||
        source.provider !== "wardogs_warcon" ||
        JSON.stringify(source) !== row.sourceFingerprint
    )
        return null
    return { row, source, input, queryJson: JSON.stringify(input) }
}
const pruneReference = makeFunctionReference<"mutation">("warconReads:prune")
export const reserve = internalMutation({
    args: accessArgs,
    handler: async (ctx, args): Promise<WarconPrepared> => {
        const access = await authorize(ctx, args)
        if (!access) return { kind: "denied" }
        const { row, source, queryJson } = access,
            now = Date.now()
        const existing = await ctx.db
            .query("warconReadCache")
            .withIndex("connection_query", (q) =>
                q.eq("connectionId", row._id).eq("queryJson", queryJson)
            )
            .unique()
        if (
            existing?.generation === row.generation &&
            existing.cacheUntil > now &&
            existing.envelopeJson
        ) {
            const parsed = warconEnvelopeSchema.safeParse(
                JSON.parse(existing.envelopeJson)
            )
            if (parsed.success) return { kind: "cached", envelope: parsed.data }
        }
        if (
            existing?.generation === row.generation &&
            existing.leaseUntil > now
        )
            return { kind: "busy", retryAfterMs: existing.leaseUntil - now }
        if (
            existing?.generation === row.generation &&
            (existing.retryUntil ?? 0) > now
        )
            return { kind: "busy", retryAfterMs: existing.retryUntil! - now }
        if ((row.warconReadBlockedUntil ?? 0) > now)
            return {
                kind: "busy",
                retryAfterMs: row.warconReadBlockedUntil! - now,
            }
        const windowAt =
            (row.warconReadWindowAt ?? 0) + 60_000 > now
                ? row.warconReadWindowAt!
                : now
        const count =
            windowAt === row.warconReadWindowAt ? (row.warconReadCount ?? 0) : 0
        if (count >= 30)
            return { kind: "busy", retryAfterMs: windowAt + 60_000 - now }
        await ctx.db.patch(row._id, {
            warconReadWindowAt: windowAt,
            warconReadCount: count + 1,
        })
        const fence = (existing?.fence ?? 0) + 1
        const state = {
            generation: row.generation,
            fence,
            leaseUntil: now + 35_000,
            cacheUntil: 0,
            retryUntil: 0,
            retainUntil: now + 3_600_000,
        }
        let cacheId = existing?._id
        if (cacheId) await ctx.db.patch(cacheId, state)
        else {
            const entries = await ctx.db
                .query("warconReadCache")
                .withIndex("connectionId", (q) => q.eq("connectionId", row._id))
                .take(64)
            if (entries.length >= 64) {
                const oldest = entries
                    .filter((e) => e.leaseUntil <= now)
                    .sort((a, b) => a.retainUntil - b.retainUntil)[0]
                if (!oldest) return { kind: "busy", retryAfterMs: 35_000 }
                await ctx.db.delete(oldest._id)
            }
            cacheId = await ctx.db.insert("warconReadCache", {
                ...state,
                connectionId: row._id,
                queryJson,
            })
            await ctx.scheduler.runAfter(3_600_000, pruneReference, { cacheId })
        }
        return {
            kind: "claimed",
            claim: {
                cacheId: String(cacheId),
                generation: row.generation,
                fence,
            },
            source,
        }
    },
})
export const finish = internalMutation({
    args: {
        ...accessArgs,
        cacheId: v.id("warconReadCache"),
        generation: v.number(),
        fence: v.number(),
        envelopeJson: v.optional(v.string()),
        errorCategory: v.optional(gameDataError),
        retryAfterMs: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<boolean> => {
        const access = await authorize(ctx, args),
            now = Date.now()
        const cache = await ctx.db.get(args.cacheId)
        if (
            !access ||
            !cache ||
            cache.connectionId !== access.row._id ||
            cache.queryJson !== access.queryJson ||
            access.row.generation !== args.generation ||
            cache.generation !== args.generation ||
            cache.fence !== args.fence ||
            cache.leaseUntil <= now
        )
            return false
        if (args.envelopeJson !== undefined) {
            if (
                args.errorCategory !== undefined ||
                new TextEncoder().encode(args.envelopeJson).length > 512 * 1024
            )
                throw new Error("Invalid Warcon response.")
            const value = warconEnvelopeSchema.parse(
                JSON.parse(args.envelopeJson)
            )
            const cacheUntil = Date.parse(value.cacheUntil)
            if (
                value.connectionId !== args.connectionId ||
                value.result.view !== access.input.view ||
                Date.parse(value.fetchedAt) > now + 5000 ||
                cacheUntil > now + warconCacheMs(access.input) + 5000
            )
                throw new Error("Invalid Warcon response.")
            await ctx.db.patch(cache._id, {
                leaseUntil: 0,
                cacheUntil,
                envelopeJson: JSON.stringify(value),
                retainUntil: now + 3_600_000,
            })
        } else {
            const delay = Number.isFinite(args.retryAfterMs)
                ? Math.max(1000, Math.min(args.retryAfterMs!, 86_400_000))
                : 30_000
            await ctx.db.patch(cache._id, {
                leaseUntil: 0,
                cacheUntil: 0,
                retryUntil: now + delay,
                envelopeJson: undefined,
            })
            if (args.errorCategory === "rate_limited")
                await ctx.db.patch(access.row._id, {
                    warconReadBlockedUntil: now + delay,
                })
        }
        return true
    },
})
export const prune = internalMutation({
    args: { cacheId: v.id("warconReadCache") },
    handler: async (ctx, args) => {
        const row = await ctx.db.get(args.cacheId)
        if (!row) return
        const wait = Math.max(row.retainUntil, row.leaseUntil) - Date.now()
        if (wait <= 0) await ctx.db.delete(row._id)
        else await ctx.scheduler.runAfter(wait, pruneReference, args)
    },
})
