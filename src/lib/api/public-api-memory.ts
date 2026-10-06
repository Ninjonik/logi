import {
    takeRateLimitToken,
    type RateLimitWindow,
} from "@/domain/api/rate-limit"
import { keyUseDue, KEY_USAGE_INTERVAL_MS } from "@/domain/api/key-usage"
import { CLAN_META_INTERVAL_MS } from "@/domain/api/clan-meta"

/**
 * Per-process memory for the public API's request path. Rate-limit windows
 * and the "last use already recorded" marks live here instead of Convex:
 * a write per request to one document made parallel requests conflict and
 * retry inside the backend, which is what degraded the self-hosted instance.
 * The limit is therefore per web instance; the owner runs one.
 */
export type PublicApiMemory = {
    takeToken(
        bucket: string,
        limit: number,
        windowMs: number,
        now?: number
    ): { allowed: boolean; remaining: number; resetAt: number }
    /** True at most once per interval per key hash in this process. */
    claimKeyUse(keyHash: string, now?: number, intervalMs?: number): boolean
    /**
     * True at most once per interval per clan in this process: the gateway
     * fires the meta summary refresh only when it wins the claim, so a
     * burst of stale meta reads schedules one recomputation, not one each.
     */
    claimClanMetaRefresh(
        guildId: string,
        now?: number,
        intervalMs?: number
    ): boolean
    size(): number
}

/** Above this many entries a write also drops the expired ones. */
const PRUNE_ABOVE = 10_000

export function createPublicApiMemory(): PublicApiMemory {
    const windows = new Map<string, RateLimitWindow>()
    const keyUses = new Map<string, number>()
    const metaRefreshes = new Map<string, number>()
    const pruneClaims = (
        claims: Map<string, number>,
        now: number,
        intervalMs: number
    ) => {
        if (claims.size > PRUNE_ABOVE)
            for (const [key, at] of claims)
                if (now - at >= intervalMs) claims.delete(key)
    }
    const prune = (now: number) => {
        if (windows.size > PRUNE_ABOVE)
            for (const [bucket, window] of windows)
                if (window.resetAt <= now) windows.delete(bucket)
        pruneClaims(keyUses, now, KEY_USAGE_INTERVAL_MS)
        pruneClaims(metaRefreshes, now, CLAN_META_INTERVAL_MS)
    }
    /** Marks the key now unless it was marked within the interval. */
    const claim = (
        claims: Map<string, number>,
        key: string,
        now: number,
        intervalMs: number
    ) => {
        prune(now)
        const at = claims.get(key)
        if (
            at !== undefined &&
            !keyUseDue(new Date(at).toISOString(), now, intervalMs)
        )
            return false
        claims.set(key, now)
        return true
    }
    return {
        takeToken(bucket, limit, windowMs, now = Date.now()) {
            prune(now)
            const decision = takeRateLimitToken(windows.get(bucket) ?? null, {
                now,
                limit,
                windowMs,
            })
            windows.set(bucket, decision.window)
            return {
                allowed: decision.allowed,
                remaining: decision.remaining,
                resetAt: decision.resetAt,
            }
        },
        claimKeyUse(
            keyHash,
            now = Date.now(),
            intervalMs = KEY_USAGE_INTERVAL_MS
        ) {
            return claim(keyUses, keyHash, now, intervalMs)
        },
        claimClanMetaRefresh(
            guildId,
            now = Date.now(),
            intervalMs = CLAN_META_INTERVAL_MS
        ) {
            return claim(metaRefreshes, guildId, now, intervalMs)
        },
        size() {
            return windows.size + keyUses.size + metaRefreshes.size
        },
    }
}

/** The process-wide instance behind the route handlers. */
export const publicApiMemory = createPublicApiMemory()
