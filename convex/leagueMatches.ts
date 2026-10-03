import {
    CACHE_MS,
    LEASE_MS,
    MAX_RETRY_AFTER_MS,
    leagueSnapshotSchema,
    leagueErrorSchema,
} from "../src/domain/wardogs-league/contracts"
import type {
    CacheState,
    Prepared,
} from "../src/application/wardogs-league/read-match"
import {
    allowsApiKeyRead,
    isApiKeyReadAccess,
} from "../src/domain/api/key-access"
import { internalMutation, type MutationCtx } from "./_generated/server"
import { matchUrl } from "../src/domain/wardogs-league/match-url"
import { makeFunctionReference } from "convex/server"
import type { Doc } from "./_generated/dataModel"
import { v } from "convex/values"
const accessArgs = {
    secret: v.string(),
    guildId: v.string(),
    sourceUrl: v.string(),
    keyHash: v.optional(v.string()),
}
type Access = {
    secret: string
    guildId: string
    sourceUrl: string
    keyHash?: string
}
const RETAIN_MS = 14 * 86400_000
const pruneRef = makeFunctionReference<"mutation">("leagueMatches:prune")
async function authorize(ctx: MutationCtx, args: Access) {
    if (
        !process.env.INTERNAL_AUTH_SECRET ||
        args.secret !== process.env.INTERNAL_AUTH_SECRET
    )
        throw new Error("Unauthorized.")
    const source = matchUrl(args.sourceUrl)
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
            !allowsApiKeyRead(key.readAccess, "league-matches", "wardogs")
        )
            return null
    }
    return source
}
function state(row: Doc<"leagueMatchCache"> | null): CacheState {
    let snapshot: CacheState["snapshot"] = null
    if (row?.snapshotJson) {
        try {
            snapshot = leagueSnapshotSchema.parse(JSON.parse(row.snapshotJson))
        } catch {
            /* Re-fetch obsolete parser contracts. */
        }
    }
    return {
        snapshot,
        lastAttemptAt: row?.lastAttemptAt ?? null,
        nextRefreshAt: row?.nextRefreshAt ?? Date.now(),
        error: row?.error ? leagueErrorSchema.parse(row.error) : null,
    }
}
export const reserve = internalMutation({
    args: accessArgs,
    handler: async (ctx, args): Promise<Prepared> => {
        const source = await authorize(ctx, args)
        if (!source) return { kind: "denied" }
        const now = Date.now()
        const row = await ctx.db
            .query("leagueMatchCache")
            .withIndex("matchId", (q) => q.eq("matchId", source.id))
            .unique()
        const current = state(row)
        if (
            row &&
            current.error &&
            current.nextRefreshAt > now + MAX_RETRY_AFTER_MS
        ) {
            current.nextRefreshAt = now + MAX_RETRY_AFTER_MS
            await ctx.db.patch(row._id, {
                nextRefreshAt: current.nextRefreshAt,
            })
        }
        if (row) await ctx.db.patch(row._id, { accessedAt: now })
        if (
            current.snapshot &&
            current.nextRefreshAt > now &&
            !current.error &&
            Date.parse(current.snapshot.fetchedAt) + CACHE_MS > now
        )
            return { kind: "ready", state: current }
        if (row && row.leaseUntil > now)
            return {
                kind: "ready",
                state: {
                    ...current,
                    nextRefreshAt: row.leaseUntil,
                    error: "refresh_in_progress",
                },
            }
        if (current.error && current.nextRefreshAt > now)
            return { kind: "ready", state: current }
        let budget = await ctx.db
            .query("leagueFetchBudget")
            .withIndex("key", (q) => q.eq("key", "public-matches"))
            .unique()
        if (!budget) {
            const id = await ctx.db.insert("leagueFetchBudget", {
                key: "public-matches",
                windowAt: now,
                count: 0,
                blockedUntil: 0,
                cachedEntries: 0,
            })
            budget = (await ctx.db.get(id))!
        }
        if (budget.blockedUntil > now + MAX_RETRY_AFTER_MS) {
            await ctx.db.patch(budget._id, {
                blockedUntil: now + MAX_RETRY_AFTER_MS,
            })
            budget = { ...budget, blockedUntil: now + MAX_RETRY_AFTER_MS }
        }
        const windowAt = budget.windowAt + 60000 > now ? budget.windowAt : now
        const count = windowAt === budget.windowAt ? budget.count : 0
        const blockedUntil = Math.max(
            budget.blockedUntil,
            count >= 20 ? windowAt + 60000 : 0
        )
        if (blockedUntil > now)
            return {
                kind: "ready",
                state: {
                    ...current,
                    nextRefreshAt: blockedUntil,
                    error: "rate_limited",
                },
            }
        let cachedEntries = budget.cachedEntries
        if (!row && cachedEntries >= 500) {
            const oldest = await ctx.db
                .query("leagueMatchCache")
                .withIndex("accessedAt")
                .order("asc")
                .first()
            if (!oldest || oldest.leaseUntil > now)
                return {
                    kind: "ready",
                    state: {
                        ...current,
                        nextRefreshAt: now + LEASE_MS,
                        error: "refresh_in_progress",
                    },
                }
            await ctx.db.delete(oldest._id)
            cachedEntries--
        }
        const fence = (row?.fence ?? 0) + 1
        const update = {
            lastAttemptAt: now,
            leaseUntil: now + LEASE_MS,
            fence,
            accessedAt: now,
        }
        let cacheId = row?._id
        if (cacheId) await ctx.db.patch(cacheId, update)
        else {
            cacheId = await ctx.db.insert("leagueMatchCache", {
                ...update,
                matchId: source.id,
                nextRefreshAt: now,
            })
            cachedEntries++
            await ctx.scheduler.runAfter(RETAIN_MS, pruneRef, { cacheId })
        }
        await ctx.db.patch(budget._id, {
            windowAt,
            count: count + 1,
            cachedEntries,
        })
        return {
            kind: "claimed",
            cacheId: String(cacheId),
            fence,
            previous: current.snapshot,
        }
    },
})
export const finish = internalMutation({
    args: {
        ...accessArgs,
        cacheId: v.id("leagueMatchCache"),
        fence: v.number(),
        snapshotJson: v.optional(v.string()),
        error: v.optional(v.string()),
        retryAfterMs: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<CacheState | null> => {
        const source = await authorize(ctx, args),
            row = await ctx.db.get(args.cacheId),
            now = Date.now()
        if (
            !source ||
            !row ||
            row.matchId !== source.id ||
            row.fence !== args.fence ||
            row.leaseUntil <= now
        )
            return null
        if (args.snapshotJson !== undefined) {
            if (
                args.error !== undefined ||
                new TextEncoder().encode(args.snapshotJson).length > 65536
            )
                throw new Error("Invalid snapshot.")
            const snapshot = leagueSnapshotSchema.parse(
                JSON.parse(args.snapshotJson)
            )
            if (
                snapshot.id !== source.id ||
                snapshot.sourceUrl !== source.url ||
                Date.parse(snapshot.fetchedAt) > now + 5000 ||
                Date.parse(snapshot.fetchedAt) < now - LEASE_MS
            )
                throw new Error("Invalid snapshot.")
            await ctx.db.patch(row._id, {
                snapshotJson: JSON.stringify(snapshot),
                leaseUntil: 0,
                error: undefined,
                nextRefreshAt: Date.parse(snapshot.fetchedAt) + CACHE_MS,
            })
        } else {
            const error = leagueErrorSchema.parse(args.error)
            const delay =
                Number.isFinite(args.retryAfterMs) && args.retryAfterMs! >= 1000
                    ? Math.min(MAX_RETRY_AFTER_MS, args.retryAfterMs!)
                    : 60000
            const until = Math.min(
                Date.parse("9999-12-31T23:59:59.000Z"),
                now + delay
            )
            await ctx.db.patch(row._id, {
                leaseUntil: 0,
                error,
                nextRefreshAt: until,
            })
            if (error === "rate_limited") {
                const budget = await ctx.db
                    .query("leagueFetchBudget")
                    .withIndex("key", (q) => q.eq("key", "public-matches"))
                    .unique()
                if (budget)
                    await ctx.db.patch(budget._id, {
                        blockedUntil: Math.max(budget.blockedUntil, until),
                    })
            }
        }
        return state(await ctx.db.get(row._id))
    },
})
export const prune = internalMutation({
    args: { cacheId: v.id("leagueMatchCache") },
    handler: async (ctx, args) => {
        const row = await ctx.db.get(args.cacheId)
        if (!row) return
        const remaining =
            Math.max(row.accessedAt + RETAIN_MS, row.leaseUntil) - Date.now()
        if (remaining > 0) {
            await ctx.scheduler.runAfter(remaining, pruneRef, args)
            return
        }
        await ctx.db.delete(row._id)
        const budget = await ctx.db
            .query("leagueFetchBudget")
            .withIndex("key", (q) => q.eq("key", "public-matches"))
            .unique()
        if (budget)
            await ctx.db.patch(budget._id, {
                cachedEntries: Math.max(0, budget.cachedEntries - 1),
            })
    },
})
