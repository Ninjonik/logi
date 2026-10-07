import {
    readWarconEnvelope,
    warconEnvelopeWithFreshness,
} from "../src/domain/game-data/warcon-payload"
import {
    hllLiveWithFreshness,
    readHllLivePayload,
} from "../src/domain/game-data/hll-live-payload"
import type { WarconEnvelope } from "../src/domain/game-data/warcon-contracts"
import type { HllLive } from "../src/domain/game-data/hll-live"
import type { Doc, Id } from "./_generated/dataModel"
import type { QueryCtx } from "./_generated/server"

/**
 * The large payloads of the live caches, kept apart from their lease rows.
 * `hllLiveCache` and `warconReadCache` hold the lease, the freshness times
 * and the counters, which change on every refresh; the provider data lives
 * in `hllLivePayloads` and `warconReadPayloads`, one row per cache row,
 * written only when the data changed. Convex stores a whole new version of
 * a document on every write, so a refresh of an idle server stores two
 * small rows instead of the payload twice (ARCHITECTURE.md, "Convex hot
 * paths"). Rows from before the split still carry the payload inline
 * (`dataJson`, `envelopeJson`); readers fall back to it and the next claim
 * drops it.
 *
 * No function definitions here: the cache modules and the bot's readers
 * (`discordPanelBot`, `discordSeedStore`) call these inside their own
 * transactions.
 */
type Db = Pick<QueryCtx, "db">

export async function hllLivePayloadRow(ctx: Db, cacheId: Id<"hllLiveCache">) {
    return await ctx.db
        .query("hllLivePayloads")
        .withIndex("cacheId", (q) => q.eq("cacheId", cacheId))
        .unique()
}

/** The stored read of a cache row with its latest times; null without one. */
export async function storedHllLive(
    ctx: Db,
    cache: Doc<"hllLiveCache">
): Promise<HllLive | null> {
    const json =
        (await hllLivePayloadRow(ctx, cache._id))?.dataJson ?? cache.dataJson
    // Written by `hllLiveReads:finish` after the action validated it; the
    // guard checks the shape, the row carries the latest times.
    const data = json ? readHllLivePayload(json) : null
    return data ? hllLiveWithFreshness(data, cache) : null
}

export async function warconPayloadRow(
    ctx: Db,
    cacheId: Id<"warconReadCache">
) {
    return await ctx.db
        .query("warconReadPayloads")
        .withIndex("cacheId", (q) => q.eq("cacheId", cacheId))
        .unique()
}

/** The stored envelope of a cache row, without its times; null without one. */
async function storedWarconPayload(
    ctx: Db,
    cache: Doc<"warconReadCache">
): Promise<WarconEnvelope | null> {
    const json =
        (await warconPayloadRow(ctx, cache._id))?.envelopeJson ??
        cache.envelopeJson
    return json ? readWarconEnvelope(json) : null
}

/** The stored envelope of a cache row with its latest times; null without one. */
export async function storedWarconEnvelope(
    ctx: Db,
    cache: Doc<"warconReadCache">
): Promise<WarconEnvelope | null> {
    const stored = await storedWarconPayload(ctx, cache)
    return stored ? warconEnvelopeWithFreshness(stored, cache) : null
}
