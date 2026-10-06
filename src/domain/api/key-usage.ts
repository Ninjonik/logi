/**
 * How often an API key's last use is recorded. Recording it on every request
 * made parallel requests from one website conflict on the key document and
 * retry inside Convex; a coarse timestamp is all the dashboard shows.
 */
export const KEY_USAGE_INTERVAL_MS = 5 * 60_000

/** Whether the stored last-use time is old enough to record again. */
export function keyUseDue(
    lastUsedAt: string | null | undefined,
    now: number,
    intervalMs = KEY_USAGE_INTERVAL_MS
) {
    if (!lastUsedAt) return true
    const last = Date.parse(lastUsedAt)
    return !Number.isFinite(last) || now - last >= intervalMs
}
