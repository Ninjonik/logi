/**
 * The one-time redraw of match messages posted before the redesign (board
 * L1 1.15, L1-147, L1-B20): the announcement, the roster card in the roster
 * channel and the forum post of upcoming matches and of matches that ended
 * in the last 14 days are redrawn once into the new cards, in place, a few
 * per minute and without pinging anyone. The marker is stored in Convex per
 * match, never anything in the message: the layout of the redrawn
 * announcement, or, for a match whose announcement the old bot had already
 * removed, the migration version recorded once its other messages were
 * redrawn.
 */

/** Bump when every posted announcement must be redrawn once. */
export const ANNOUNCEMENT_LAYOUT_VERSION = "l1-2026-10-roster"

/** Matches that ended longer ago keep their old message (L1-148). */
export const ANNOUNCEMENT_MIGRATION_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

/** "A few messages per minute" (L1-151). */
export const ANNOUNCEMENT_MIGRATIONS_PER_MINUTE = 6

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The earliest `gameEnd` a bounded read of the matches must return so that
 * {@link isAnnouncementMigrationDue} sees every match that may still be due:
 * the window's start, as an ISO instant, with a day of slack. Every writer
 * stores `toISOString()` output, which sorts chronologically; the slack
 * covers an end that a client wrote with a UTC offset, which sorts by its
 * local time. The rule decides exactly, this only bounds the read.
 */
export function announcementMigrationScanStart(now: Date): string {
    return new Date(
        now.getTime() - ANNOUNCEMENT_MIGRATION_WINDOW_MS - DAY_MS
    ).toISOString()
}

/**
 * Whether a match still has a message drawn by the old bot to redraw: the
 * announcement card, the roster card in the roster channel, or the forum's
 * "Informace o zápasu" post. The old bot removed the announcement once
 * sign-ups closed in split mode, so the roster card and the forum post
 * count on their own (L1-147).
 */
export function hasMigratableMessage(
    sync:
        | {
              announcementMessageId?: string | null
              eventInfoMessageId?: string | null
              infoMessageId?: string | null
          }
        | null
        | undefined
) {
    return Boolean(
        sync?.announcementMessageId ||
        sync?.eventInfoMessageId ||
        sync?.infoMessageId
    )
}

/**
 * Whether a match's messages still need the one-time redraw: one was
 * posted, neither marker says it was redrawn, and the match is upcoming or
 * ended inside the window.
 */
export function isAnnouncementMigrationDue(input: {
    gameEnd: string
    now: Date
    /** {@link hasMigratableMessage} of the match's sync state. */
    hasMessage: boolean
    /** The layout the announcement card was last drawn with. */
    layoutVersion: string | null | undefined
    /** Recorded once a match without a card had its other messages redrawn. */
    migrationVersion?: string | null
    version: string
}) {
    if (
        !input.hasMessage ||
        input.layoutVersion === input.version ||
        input.migrationVersion === input.version
    )
        return false
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
