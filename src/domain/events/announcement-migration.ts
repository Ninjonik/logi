/**
 * The one-time redraw of match announcements posted before the redesign
 * (board L1 1.15, L1-B20): cards of upcoming matches and of matches that
 * ended in the last 14 days are redrawn once into the new card, in place, a
 * few per minute and without pinging anyone. The marker is the card layout
 * stored in Convex per match, never anything in the message.
 */

/** Bump when every posted announcement must be redrawn once. */
export const ANNOUNCEMENT_LAYOUT_VERSION = "l1-2026-10"

/** Matches that ended longer ago keep their old message (L1-148). */
export const ANNOUNCEMENT_MIGRATION_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

/** "A few messages per minute" (L1-151). */
export const ANNOUNCEMENT_MIGRATIONS_PER_MINUTE = 6

/**
 * Whether a match's card still needs the one-time redraw: it was posted, it
 * was drawn with another layout, and the match is upcoming or ended inside
 * the window.
 */
export function isAnnouncementMigrationDue(input: {
    gameEnd: string
    now: Date
    hasCard: boolean
    layoutVersion: string | null | undefined
    version: string
}) {
    if (!input.hasCard || input.layoutVersion === input.version) return false
    const gameEnd = Date.parse(input.gameEnd)
    return (
        Number.isFinite(gameEnd) &&
        gameEnd >= input.now.getTime() - ANNOUNCEMENT_MIGRATION_WINDOW_MS
    )
}

export type MigrationBucket = { tokens: number; at: number }

/**
 * A token bucket for redraws: `perMinute` tokens refill evenly over a minute
 * and at most `perMinute` wait. Returns whether one redraw may run now and
 * the next state.
 */
export function takeMigrationToken(
    bucket: MigrationBucket | null,
    now: number,
    perMinute = ANNOUNCEMENT_MIGRATIONS_PER_MINUTE
): { allowed: boolean; bucket: MigrationBucket } {
    const capacity = Math.max(1, perMinute)
    const previous = bucket ?? { tokens: capacity, at: now }
    const refilled = Math.min(
        capacity,
        previous.tokens + ((now - previous.at) / 60_000) * capacity
    )
    return refilled >= 1
        ? { allowed: true, bucket: { tokens: refilled - 1, at: now } }
        : { allowed: false, bucket: { tokens: refilled, at: now } }
}
