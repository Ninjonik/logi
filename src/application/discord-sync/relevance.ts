/**
 * Which events the Discord bot still acts on. The bot keeps every published
 * event that is not concluded, whatever its date, and a concluded event for
 * seven days after it ended; after that the event is historical and its
 * messages are left alone. Convex bounds its reads for the bot with the same
 * window, so both runtimes share this rule.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** How long a concluded event stays in the bot's working set after it ended. */
export const CONCLUDED_EVENT_RETENTION_MS = 7 * DAY_MS

/** The exact rule: concluded, and ended more than seven days before `now`. */
export function isHistoricalConcludedEvent(
    event: { status?: string; gameEnd?: string },
    now = new Date()
) {
    if (event.status !== "concluded") return false
    const gameEnd = event.gameEnd
        ? new Date(event.gameEnd).getTime()
        : Number.NaN
    return (
        Number.isFinite(gameEnd) &&
        gameEnd < now.getTime() - CONCLUDED_EVENT_RETENTION_MS
    )
}

/**
 * The earliest `gameEnd` a bounded read of the concluded events must return
 * so that {@link isHistoricalConcludedEvent} still sees every event the bot
 * acts on: the window's start, as an ISO instant, with a day of slack. Every
 * writer stores `toISOString()` output, which sorts chronologically; the
 * slack covers an end that a client wrote with a UTC offset, which sorts by
 * its local time. The rule decides exactly, this only bounds the read.
 */
export function historicalConcludedEventCutoff(now: Date): string {
    return new Date(
        now.getTime() - CONCLUDED_EVENT_RETENTION_MS - DAY_MS
    ).toISOString()
}
