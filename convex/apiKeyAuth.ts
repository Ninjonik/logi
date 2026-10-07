import { keyUseDue } from "../src/domain/api/key-usage"
import { assertInternalSecret } from "./discord_shared"
import { mutation, query } from "./_generated/server"
import { getGuildByDiscordId } from "./identity"
import { v } from "convex/values"

/**
 * API key authentication, deliberately in a module of its own: every
 * `/api/v1` request runs it, and a Convex function pays for evaluating its
 * whole module graph on each fresh isolate. `publicApi.ts` bundles to more
 * than a megabyte (use-cases, repositories, map data); this file stays tiny.
 */

async function keyByHash(
    ctx: { db: Parameters<typeof getGuildByDiscordId>[0]["db"] },
    keyHash: string
) {
    return await ctx.db
        .query("apiKeys")
        .withIndex("keyHash", (q) => q.eq("keyHash", keyHash))
        .unique()
}

/**
 * Authenticates a hash only; callers never receive a bearer key or its hash.
 * A read-only query: the request path must not write, because a write to the
 * key document on every request made parallel requests from one website
 * conflict and retry inside Convex until the backend degraded.
 */
export const authenticateKey = query({
    args: { secret: v.string(), keyHash: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await keyByHash(ctx, args.keyHash)
        if (!key || key.revokedAt) return null
        const guild = await getGuildByDiscordId(ctx, key.guildId)
        if (!guild) return null
        return {
            guildId: key.guildId,
            lastUsedAt: key.lastUsedAt ?? null,
            ...(key.readAccess !== undefined
                ? { readAccess: key.readAccess }
                : {}),
        }
    },
})

/**
 * Usage telemetry, off the request path: the gateway calls this at most once
 * per `KEY_USAGE_INTERVAL_MS` per key, and the mutation checks the stored
 * time again so concurrent calls write once. Never alters authorization.
 */
export const recordKeyUse = mutation({
    args: { secret: v.string(), keyHash: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await keyByHash(ctx, args.keyHash)
        if (!key || key.revokedAt) return false
        const now = Date.now()
        if (!keyUseDue(key.lastUsedAt, now)) return false
        await ctx.db.patch(key._id, {
            lastUsedAt: new Date(now).toISOString(),
        })
        return true
    },
})
