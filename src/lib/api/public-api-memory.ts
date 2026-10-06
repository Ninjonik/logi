import {
    takeRateLimitToken,
    type RateLimitWindow,
} from "@/domain/api/rate-limit"
import { keyUseDue, KEY_USAGE_INTERVAL_MS } from "@/domain/api/key-usage"

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
    size(): number
}

/** Above this many entries a write also drops the expired ones. */
const PRUNE_ABOVE = 10_000

export function createPublicApiMemory(): PublicApiMemory {
    const windows = new Map<string, RateLimitWindow>()
    const keyUses = new Map<string, number>()
    const prune = (now: number, intervalMs: number) => {
        if (windows.size > PRUNE_ABOVE)
            for (const [bucket, window] of windows)
                if (window.resetAt <= now) windows.delete(bucket)
        if (keyUses.size > PRUNE_ABOVE)
            for (const [hash, at] of keyUses)
                if (now - at >= intervalMs) keyUses.delete(hash)
    }
    return {
        takeToken(bucket, limit, windowMs, now = Date.now()) {
            prune(now, KEY_USAGE_INTERVAL_MS)
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
            prune(now, intervalMs)
            const at = keyUses.get(keyHash)
            if (
                at !== undefined &&
                !keyUseDue(new Date(at).toISOString(), now, intervalMs)
            )
                return false
            keyUses.set(keyHash, now)
            return true
        },
        size() {
            return windows.size + keyUses.size
        },
    }
}

/** The process-wide instance behind the route handlers. */
export const publicApiMemory = createPublicApiMemory()
