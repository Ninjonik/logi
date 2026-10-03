import {
    MAX_RETRY_AFTER_MS,
    leagueReadSchema,
    leagueSnapshotSchema,
} from "../src/domain/wardogs-league/contracts"
import {
    trackingAdmission,
    trackingConfig,
    updateTracked,
} from "./leagueTrackingStore"
import { selectTrackedSnapshot } from "../src/application/wardogs-league/accept-snapshot"
import { trackingDecision } from "../src/application/wardogs-league/tracking"
import { SCAN_MS, TRACK_MS } from "../src/domain/wardogs-league/discovery"
import { internalMutation, internalQuery } from "./_generated/server"
import { matchUrl } from "../src/domain/wardogs-league/match-url"
import { v } from "convex/values"
export const status = internalQuery({
    args: {},
    handler: async (ctx) => ({
        settings: await ctx.db
            .query("leagueTrackingSettings")
            .withIndex("enabled", (q) => q.eq("enabled", true))
            .take(100),
        index: await ctx.db
            .query("leagueIndexCache")
            .withIndex("key", (q) => q.eq("key", "indexes"))
            .unique(),
    }),
})
export const pruneReferences = internalMutation({
    args: {},
    handler: async (ctx) => {
        const expired = await ctx.db
            .query("leagueMessageRefs")
            .withIndex("expiresAt", (q) =>
                q.gt("expiresAt", 0).lte("expiresAt", Date.now())
            )
            .take(200)
        for (const row of expired) await ctx.db.delete(row._id)
    },
})
export const claimScan = internalMutation({
    args: {},
    handler: async (ctx) => {
        if (
            !(await ctx.db
                .query("leagueTrackingSettings")
                .withIndex("enabled", (q) => q.eq("enabled", true))
                .first())
        )
            return null
        let row = await ctx.db
            .query("leagueIndexCache")
            .withIndex("key", (q) => q.eq("key", "indexes"))
            .unique()
        const now = Date.now()
        if (row && (row.leaseUntil > now || row.nextScanAt > now)) return null
        if (!row) {
            const id = await ctx.db.insert("leagueIndexCache", {
                key: "indexes",
                matchUrls: [],
                fixtureUrls: [],
                incomplete: false,
                nextScanAt: now,
                leaseUntil: 0,
                fence: 0,
            })
            row = (await ctx.db.get(id))!
        }
        const fence = row.fence + 1
        await ctx.db.patch(row._id, {
            fence,
            leaseUntil: now + 60_000,
            lastAttemptAt: now,
        })
        return { id: row._id, fence }
    },
})
/** Index requests share the same origin budget and cooldown as on-demand details. */
export const reserveIndexFetch = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now()
        let row = await ctx.db
            .query("leagueFetchBudget")
            .withIndex("key", (q) => q.eq("key", "public-matches"))
            .unique()
        if (!row) {
            const id = await ctx.db.insert("leagueFetchBudget", {
                key: "public-matches",
                windowAt: now,
                count: 0,
                blockedUntil: 0,
                cachedEntries: 0,
            })
            row = (await ctx.db.get(id))!
        }
        const windowAt = row.windowAt + 60_000 > now ? row.windowAt : now,
            count = windowAt === row.windowAt ? row.count : 0
        const until = Math.max(
            Math.min(row.blockedUntil, now + MAX_RETRY_AFTER_MS),
            count >= 20 ? windowAt + 60_000 : 0
        )
        if (until > now) return until - now
        await ctx.db.patch(row._id, { windowAt, count: count + 1 })
        return 0
    },
})
export const finishScan = internalMutation({
    args: {
        id: v.id("leagueIndexCache"),
        fence: v.number(),
        matchUrls: v.optional(v.array(v.string())),
        fixtureUrls: v.optional(v.array(v.string())),
        incomplete: v.optional(v.boolean()),
        error: v.optional(v.string()),
        retryAfterMs: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const row = await ctx.db.get(args.id),
            now = Date.now()
        if (!row || row.fence !== args.fence || row.leaseUntil <= now) return
        if (args.matchUrls && args.fixtureUrls) {
            if (args.matchUrls.length > 500 || args.fixtureUrls.length > 500)
                throw new Error("Index limit.")
            const urls = [
                ...new Set(args.matchUrls.map((url) => matchUrl(url).url)),
            ]
            await ctx.db.patch(row._id, {
                matchUrls: urls,
                fixtureUrls: args.fixtureUrls.map((url) => matchUrl(url).url),
                incomplete: args.incomplete ?? false,
                fetchedAt: now,
                nextScanAt: now + SCAN_MS,
                leaseUntil: 0,
                error: undefined,
            })
        } else {
            const delay = Math.max(
                60_000,
                Math.min(args.retryAfterMs ?? 60_000, MAX_RETRY_AFTER_MS)
            )
            await ctx.db.patch(row._id, {
                error: args.error ?? "network",
                nextScanAt: now + delay,
                leaseUntil: 0,
            })
            if (args.error === "rate_limited") {
                const budget = await ctx.db
                    .query("leagueFetchBudget")
                    .withIndex("key", (q) => q.eq("key", "public-matches"))
                    .unique()
                if (budget)
                    await ctx.db.patch(budget._id, {
                        blockedUntil: Math.max(
                            budget.blockedUntil,
                            now + delay
                        ),
                    })
            }
        }
    },
})
export const enqueueIndex = internalMutation({
    args: {
        guildId: v.string(),
        revision: v.number(),
        indexAt: v.number(),
        urls: v.array(v.string()),
        fixtureUrls: v.array(v.string()),
        complete: v.boolean(),
    },
    handler: async (ctx, args) => {
        const config = await trackingConfig(ctx, args.guildId)
        if (
            !config?.enabled ||
            config.revision !== args.revision ||
            args.urls.length > 50 ||
            args.fixtureUrls.length > 500
        )
            return
        const pool = await trackingAdmission(ctx, args.guildId)
        let queueFull = false
        for (const url of args.urls) {
            const source = matchUrl(url)
            const row = await pool.admit(source.id, "index")
            if (!row) {
                queueFull = true
                continue
            }
            if (
                !row.ignored &&
                !row.paused &&
                row.state === "unmatched" &&
                (!config.lastIndexAt || args.fixtureUrls.includes(source.url))
            )
                await ctx.db.patch(row._id, {
                    state: "pending",
                    nextRefreshAt: Date.now(),
                })
        }
        await ctx.db.patch(config._id, {
            ...(args.complete ? { lastIndexAt: args.indexAt } : {}),
            queueFull: queueFull || (config.queueFull ?? false),
        })
    },
})
export const claimDue = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now()
        const candidates = (
            await Promise.all(
                (["pending", "tracked"] as const).map((state) =>
                    ctx.db
                        .query("leagueTrackedMatches")
                        .withIndex("due", (q) =>
                            q.eq("state", state).lte("nextRefreshAt", now)
                        )
                        .take(30)
                )
            )
        )
            .flat()
            .sort((a, b) => a.nextRefreshAt - b.nextRefreshAt)
        for (const row of candidates) {
            if (row.leaseUntil > now || row.ignored || row.paused) continue
            if (
                !row.manualRefresh &&
                !row.snapshotJson &&
                row.firstSeenAt + 14 * 86400_000 <= now
            ) {
                await updateTracked(ctx, row, {
                    state: "archived",
                    leaseUntil: 0,
                })
                continue
            }
            const config = await trackingConfig(ctx, row.guildId)
            if (!config?.enabled) continue
            const fence = row.fence + 1
            await ctx.db.patch(row._id, {
                fence,
                leaseUntil: now + 30_000,
                lastAttemptAt: now,
                nextRefreshAt: now + TRACK_MS,
            })
            return {
                id: row._id,
                fence,
                guildId: row.guildId,
                matchId: row.matchId,
                settingsRevision: config.revision,
            }
        }
        return null
    },
})
export const finishRead = internalMutation({
    args: {
        id: v.id("leagueTrackedMatches"),
        fence: v.number(),
        settingsRevision: v.number(),
        readJson: v.string(),
    },
    handler: async (ctx, args) => {
        const row = await ctx.db.get(args.id),
            now = Date.now()
        if (!row || row.fence !== args.fence || row.leaseUntil <= now) return
        const config = await trackingConfig(ctx, row.guildId)
        if (!config?.enabled || config.revision !== args.settingsRevision)
            return
        if (args.readJson.length > 100_000) throw new Error("Read too large.")
        const read = leagueReadSchema.parse(JSON.parse(args.readJson))
        if (
            read.snapshot &&
            (read.snapshot.id !== row.matchId ||
                read.snapshot.sourceUrl !==
                    matchUrl(`https://wardogsleague.net/matches/${row.matchId}`)
                        .url)
        )
            throw new Error("Unexpected match.")
        const selected = selectTrackedSnapshot(
            row.snapshotJson
                ? leagueSnapshotSchema.parse(JSON.parse(row.snapshotJson))
                : null,
            read.snapshot
        )
        const snapshot = selected.snapshot
        const decision = snapshot
            ? trackingDecision(row, snapshot, config.teamCodes, now)
            : {}
        await updateTracked(ctx, row, {
            ...decision,
            manualRefresh: false,
            ...(snapshot ? { snapshotJson: JSON.stringify(snapshot) } : {}),
            error: selected.rejected
                ? "invalid_html"
                : (read.error ?? undefined),
            leaseUntil: 0,
            nextRefreshAt: Math.max(
                now + TRACK_MS,
                Math.min(
                    Date.parse(read.nextRefreshAt),
                    now + MAX_RETRY_AFTER_MS
                )
            ),
        })
    },
})
