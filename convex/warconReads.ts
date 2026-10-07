import {
    readWarconEnvelope,
    warconComparable,
    warconFreshnessOf,
} from "../src/domain/game-data/warcon-payload"
import {
    readWarconQueryPayload,
    warconCacheMs,
} from "../src/domain/game-data/warcon-query-payload"
import {
    authorizeDashboardAdmin,
    dashboardActor,
    type DashboardActor,
} from "./dashboardActor"
import {
    allowsApiKeyRead,
    isApiKeyReadAccess,
} from "../src/domain/api/key-access"
import { panelReadsConnection } from "../src/domain/discord-publications/settings"
import type { WarconPrepared } from "../src/application/game-data/read-warcon"
import { storedWarconEnvelope, warconPayloadRow } from "./liveReadPayloads"
import { internalMutation, type MutationCtx } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import { gameDataError } from "./gameDataValidators"
import { connectionSource } from "./gameDataCatalog"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"

const accessArgs = {
    secret: v.string(),
    guildId: v.string(),
    connectionId: v.string(),
    keyHash: v.optional(v.string()),
    actor: v.optional(dashboardActor),
    panelId: v.optional(v.id("discordPublicPanels")),
    queryJson: v.string(),
}
type Access = {
    secret: string
    guildId: string
    connectionId: string
    keyHash?: string
    actor?: DashboardActor
    panelId?: Id<"discordPublicPanels">
    queryJson: string
}
async function authorize(ctx: MutationCtx, args: Access) {
    if (
        !process.env.INTERNAL_AUTH_SECRET ||
        args.secret !== process.env.INTERNAL_AUTH_SECRET
    )
        throw new Error("Unauthorized.")
    if (args.queryJson.length > 1500) throw new Error("Invalid Warcon query.")
    // `warconData:read` parsed and normalised the query with
    // `warconQuerySchema` before calling these internal mutations.
    const input = readWarconQueryPayload(args.queryJson)
    if (!input) throw new Error("Invalid Warcon query.")
    if (args.panelId !== undefined) {
        if (
            args.keyHash !== undefined ||
            args.actor !== undefined ||
            input.view !== "live"
        )
            return null
        const panel = await ctx.db.get(args.panelId)
        if (
            !panel?.enabled ||
            panel.guildId !== args.guildId ||
            !panelReadsConnection(panel, args.connectionId)
        )
            return null
    } else if (args.keyHash !== undefined) {
        if (args.actor !== undefined) return null
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
    } else {
        if (!args.actor) return null
        try {
            await authorizeDashboardAdmin(ctx, { ...args, actor: args.actor })
        } catch {
            return null
        }
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
    const source = await connectionSource(ctx, row)
    if (!source || source.provider !== "wardogs_warcon") return null
    return { row, source, input, queryJson: JSON.stringify(input) }
}
const pruneReference = makeFunctionReference<"mutation">("warconReads:prune")
async function warconLimitRow(
    ctx: MutationCtx,
    connectionId: Id<"gameDataConnections">
) {
    return await ctx.db
        .query("warconReadLimits")
        .withIndex("connectionId", (q) => q.eq("connectionId", connectionId))
        .unique()
}
async function deletePayload(ctx: MutationCtx, cacheId: Id<"warconReadCache">) {
    const payload = await warconPayloadRow(ctx, cacheId)
    if (payload) await ctx.db.delete(payload._id)
}
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
            existing.cacheUntil > now
        ) {
            // The payload row with the cache row's latest times.
            const stored = await storedWarconEnvelope(ctx, existing)
            if (stored) return { kind: "cached", envelope: stored }
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
        // The connection's read budget lives in its own small row; the
        // fields on `gameDataConnections` are read only until it exists.
        const limit = await warconLimitRow(ctx, row._id)
        const blockedUntil = Math.max(
            limit?.blockedUntil ?? 0,
            row.warconReadBlockedUntil ?? 0
        )
        if (blockedUntil > now)
            return { kind: "busy", retryAfterMs: blockedUntil - now }
        const lastWindowAt = limit?.windowAt ?? row.warconReadWindowAt ?? 0
        const windowAt = lastWindowAt + 60_000 > now ? lastWindowAt : now
        const count =
            windowAt === lastWindowAt
                ? (limit?.count ?? row.warconReadCount ?? 0)
                : 0
        if (count >= 30)
            return { kind: "busy", retryAfterMs: windowAt + 60_000 - now }
        if (limit) await ctx.db.patch(limit._id, { windowAt, count: count + 1 })
        else
            await ctx.db.insert("warconReadLimits", {
                connectionId: row._id,
                windowAt,
                count: count + 1,
                blockedUntil: 0,
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
        if (existing) {
            // The claim writes the small row only; a payload still inline
            // from before the split is dropped, `finish` writes its row.
            await ctx.db.patch(existing._id, {
                ...state,
                ...(existing.envelopeJson === undefined
                    ? {}
                    : { envelopeJson: undefined }),
            })
            // Another source generation's data is never compared or served.
            if (existing.generation !== row.generation)
                await deletePayload(ctx, existing._id)
        } else {
            const entries = await ctx.db
                .query("warconReadCache")
                .withIndex("connectionId", (q) => q.eq("connectionId", row._id))
                .take(64)
            if (entries.length >= 64) {
                const oldest = entries
                    .filter((e) => e.leaseUntil <= now)
                    .sort((a, b) => a.retainUntil - b.retainUntil)[0]
                if (!oldest) return { kind: "busy", retryAfterMs: 35_000 }
                await deletePayload(ctx, oldest._id)
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
            // The action built the envelope with `warconEnvelopeSchema`
            // before calling this internal mutation; the guard checks the shape.
            const value = readWarconEnvelope(args.envelopeJson)
            if (!value) throw new Error("Invalid Warcon response.")
            const cacheUntil = Date.parse(value.cacheUntil)
            if (
                value.connectionId !== args.connectionId ||
                value.result.view !== access.input.view ||
                Date.parse(value.fetchedAt) > now + 5000 ||
                cacheUntil > now + warconCacheMs(access.input) + 5000
            )
                throw new Error("Invalid Warcon response.")
            // An idle server reads the same every time: the payload row is
            // written only when the provider data changed; the times go to
            // the small cache row (ARCHITECTURE.md, "Convex hot paths").
            const payload = await warconPayloadRow(ctx, cache._id)
            const stored = payload
                ? readWarconEnvelope(payload.envelopeJson)
                : null
            if (
                stored === null ||
                warconComparable(stored) !== warconComparable(value)
            ) {
                const envelopeJson = JSON.stringify(value)
                if (payload) await ctx.db.patch(payload._id, { envelopeJson })
                else
                    await ctx.db.insert("warconReadPayloads", {
                        cacheId: cache._id,
                        envelopeJson,
                    })
            }
            await ctx.db.patch(cache._id, {
                leaseUntil: 0,
                cacheUntil,
                ...warconFreshnessOf(value),
                ...(cache.envelopeJson === undefined
                    ? {}
                    : { envelopeJson: undefined }),
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
                ...(cache.envelopeJson === undefined
                    ? {}
                    : { envelopeJson: undefined }),
            })
            // A failed read serves nothing until the next success.
            await deletePayload(ctx, cache._id)
            if (args.errorCategory === "rate_limited") {
                const limit = await warconLimitRow(ctx, access.row._id)
                if (limit)
                    await ctx.db.patch(limit._id, {
                        blockedUntil: now + delay,
                    })
                else
                    await ctx.db.insert("warconReadLimits", {
                        connectionId: access.row._id,
                        windowAt: now,
                        count: 0,
                        blockedUntil: now + delay,
                    })
            }
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
        if (wait <= 0) {
            await deletePayload(ctx, row._id)
            await ctx.db.delete(row._id)
        } else await ctx.scheduler.runAfter(wait, pruneReference, args)
    },
})
