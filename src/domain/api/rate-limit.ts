/** One fixed window of a rate-limit bucket. */
export type RateLimitWindow = { count: number; resetAt: number }

export type RateLimitDecision = {
    allowed: boolean
    remaining: number
    resetAt: number
    /** The window after this request; the caller stores it. */
    window: RateLimitWindow
}

/**
 * Takes one token from a fixed window: a missing or expired window starts a
 * new one, a full window refuses without changing anything. Pure, so the
 * store (process memory, a database row) is the caller's choice.
 */
export function takeRateLimitToken(
    window: RateLimitWindow | null,
    input: { now: number; limit: number; windowMs: number }
): RateLimitDecision {
    if (!window || window.resetAt <= input.now) {
        const fresh = { count: 1, resetAt: input.now + input.windowMs }
        return {
            allowed: true,
            remaining: Math.max(0, input.limit - 1),
            resetAt: fresh.resetAt,
            window: fresh,
        }
    }
    if (window.count >= input.limit)
        return {
            allowed: false,
            remaining: 0,
            resetAt: window.resetAt,
            window,
        }
    const next = { count: window.count + 1, resetAt: window.resetAt }
    return {
        allowed: true,
        remaining: Math.max(0, input.limit - next.count),
        resetAt: next.resetAt,
        window: next,
    }
}
