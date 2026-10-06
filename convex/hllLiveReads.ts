import {
    hllLiveComparable,
    hllLiveFreshness,
    hllLiveWithFreshness,
    readHllLivePayload,
} from "../src/domain/game-data/hll-live-payload"
import {
    allowsApiKeyRead,
    isApiKeyReadAccess,
} from "../src/domain/api/key-access"
import { panelReadsConnection } from "../src/domain/discord-publications/settings"
import type { HllPrepared } from "../src/application/game-data/read-hll-live"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { internalMutation, type MutationCtx } from "./_generated/server"
import type { DashboardActor } from "./dashboardActor"
import { makeFunctionReference } from "convex/server"
import { connectionSource } from "./gameDataCatalog"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"

export const hllLiveAccess = {
    secret: v.string(),
    guildId: v.string(),
    connectionId: v.string(),
    keyHash: v.optional(v.string()),
    panelId: v.optional(v.id("discordPublicPanels")),
    panelRevision: v.optional(v.number()),
    /** A clan admin's test read from the panel editor (P2-B10). */
    actor: v.optional(dashboardActor),
}
type Access = {
    secret: string
    guildId: string
    connectionId: string
    keyHash?: string
    panelId?: Id<"discordPublicPanels">
    panelRevision?: number
    actor?: DashboardActor
}
async function authorize(ctx: MutationCtx, args: Access) {
    if (
        !process.env.INTERNAL_AUTH_SECRET ||
        args.secret !== process.env.INTERNAL_AUTH_SECRET
    )
        throw new Error("Unauthorized.")
    if (args.panelId !== undefined) {
        if (args.keyHash !== undefined || args.actor !== undefined) return null
        const panel = await ctx.db.get(args.panelId)
        if (
            !panel?.enabled ||
            panel.guildId !== args.guildId ||
            !panelReadsConnection(panel, args.connectionId) ||
            panel.revision !== args.panelRevision
        )
            return null
    } else if (args.actor !== undefined) {
        // The dashboard's test read: a current clan admin, nothing else.
        if (args.keyHash !== undefined || args.panelRevision !== undefined)
            return null
        try {
            await authorizeDashboardAdmin(ctx, { ...args, actor: args.actor })
        } catch {
            return null
        }
    } else {
        if (!args.keyHash || args.panelRevision !== undefined) return null
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash!))
            .unique()
        if (
            !key ||
            key.revokedAt ||
            key.guildId !== args.guildId ||
            !isApiKeyReadAccess(key.readAccess) ||
            !allowsApiKeyRead(key.readAccess, "hll-live", "hell_let_loose")
        )
            return null
    }
    const id = ctx.db.normalizeId("gameDataConnections", args.connectionId),
        row = id ? await ctx.db.get(id) : null
    if (
        !row?.enabled ||
        row.guildId !== args.guildId ||
        row.provider !== "hll_crcon" ||
        row.gameId !== "hell_let_loose"
    )
        return null
    const source = await connectionSource(ctx, row)
    if (!source || source.provider !== "hll_crcon") return null
    return { row, source }
}
export const reserve = internalMutation({
    args: hllLiveAccess,
    handler: async (ctx, args): Promise<HllPrepared> => {
        const access = await authorize(ctx, args)
        if (!access) return { kind: "denied" }
        const { row, source } = access,
            now = Date.now()
        const cache = await ctx.db
            .query("hllLiveCache")
            .withIndex("connectionId", (q) => q.eq("connectionId", row._id))
            .unique()
        // The payload was validated by the read action before `finish` stored
        // it; it is read back through the guard with the row's latest times.
        const stored =
            cache?.generation === row.generation && cache.dataJson
                ? readHllLivePayload(cache.dataJson)
                : null
        const previous = stored
            ? hllLiveWithFreshness(stored, cache!)
            : undefined
        const mapChanged = Boolean(
            previous?.status &&
            row.observation &&
            Date.parse(row.observation.observedAt) >
                Date.parse(previous.statusAt ?? "") &&
            row.observation.map !== previous.status.map
        )
        if (previous && !mapChanged && cache!.nextAt > now)
            return { kind: "cached", data: previous }
        if (cache?.generation === row.generation && cache.leaseUntil > now)
            return { kind: "busy", retryAfterMs: cache.leaseUntil - now }
        // Even a map change must respect a provider Retry-After/cache budget.
        if (
            cache?.generation === row.generation &&
            mapChanged &&
            cache.nextAt > now
        )
            return { kind: "busy", retryAfterMs: cache.nextAt - now }
        const fence = (cache?.fence ?? 0) + 1,
            lease = {
                generation: row.generation,
                fence,
                leaseUntil: now + 35_000,
                nextAt: 0,
                retainUntil: now + 3_600_000,
            }
        // `dataJson` is large and every version of it is retained, so a
        // claim patches the lease fields only; `finish` writes the data. It
        // is dropped, never copied, when it stops serving as `previous`: the
        // map changed, or the source generation did (ARCHITECTURE.md,
        // "Convex hot paths").
        const keepData = Boolean(previous) && !mapChanged
        let cacheId = cache?._id
        if (cache)
            await ctx.db.patch(cache._id, {
                ...lease,
                ...(keepData || cache.dataJson === undefined
                    ? {}
                    : { dataJson: undefined }),
            })
        else {
            cacheId = await ctx.db.insert("hllLiveCache", {
                ...lease,
                connectionId: row._id,
            })
            await ctx.scheduler.runAfter(
                3_600_000,
                makeFunctionReference<"mutation">("hllLiveReads:prune"),
                { cacheId }
            )
        }
        return {
            kind: "claimed",
            source,
            claim: {
                cacheId: String(cacheId),
                generation: row.generation,
                fence,
            },
            ...(previous && !mapChanged ? { previous } : {}),
        }
    },
})
export const finish = internalMutation({
    args: {
        ...hllLiveAccess,
        cacheId: v.id("hllLiveCache"),
        generation: v.number(),
        fence: v.number(),
        dataJson: v.string(),
    },
    handler: async (ctx, args) => {
        const access = await authorize(ctx, args),
            cache = await ctx.db.get(args.cacheId),
            now = Date.now()
        if (
            !access ||
            !cache ||
            cache.connectionId !== access.row._id ||
            access.row.generation !== args.generation ||
            cache.generation !== args.generation ||
            cache.fence !== args.fence ||
            cache.leaseUntil <= now
        )
            return false
        if (new TextEncoder().encode(args.dataJson).length > 256 * 1024)
            throw new Error("Invalid HLL response.")
        // The read action parsed the provider's reply with `hllLiveSchema`
        // before calling this internal mutation; the guard checks the shape.
        const data = readHllLivePayload(args.dataJson)
        if (!data) throw new Error("Invalid HLL response.")
        if (
            Date.parse(data.fetchedAt) > now + 5000 ||
            now - Date.parse(data.fetchedAt) > 35_000 ||
            [data.statusAt, data.playersAt].some(
                (at) => at && Date.parse(at) > now + 5000
            )
        )
            throw new Error("Invalid HLL observation time.")
        // An idle server reads the same every time: the large payload is
        // rewritten only when the provider data changed; the times go to
        // their own small fields (ARCHITECTURE.md, "Convex hot paths").
        const stored = cache.dataJson
            ? readHllLivePayload(cache.dataJson)
            : null
        const unchanged =
            stored !== null &&
            hllLiveComparable(stored) === hllLiveComparable(data)
        await ctx.db.patch(cache._id, {
            ...(unchanged ? {} : { dataJson: JSON.stringify(data) }),
            ...hllLiveFreshness(data),
            leaseUntil: 0,
            nextAt: now + data.refreshAfterSeconds * 1000,
            retainUntil: now + 3_600_000,
        })
        return true
    },
})
export const prune = internalMutation({
    args: { cacheId: v.id("hllLiveCache") },
    handler: async (ctx, args) => {
        const cache = await ctx.db.get(args.cacheId)
        if (!cache) return
        const wait =
            Math.max(cache.retainUntil, cache.leaseUntil, cache.nextAt) -
            Date.now()
        if (wait <= 0) await ctx.db.delete(cache._id)
        else
            await ctx.scheduler.runAfter(
                wait,
                makeFunctionReference<"mutation">("hllLiveReads:prune"),
                args
            )
    },
})
