/**
 * Retention of the tables that gain a row per request, run or change and had
 * no limit of their own (owner decision, October 2026): historical rows are
 * kept 30 days, short-lived requests a day after they expire, and a League
 * link's message reference 14 days after it was posted. Match statistics
 * (`gameSessions`, `serverGameHistory`, `playerStats`, `matchStats`,
 * `eventResultRevisions`) and `matchRecaps`, whose rows are the recap dedupe
 * guard, keep no limit and are never listed here.
 */
const DAY_MS = 24 * 60 * 60 * 1000

/** Webhook deliveries, receipts, reminders, seed runs, sign-up activity, roster change requests. */
export const HISTORY_RETENTION_MS = 30 * DAY_MS
/** Meeting attendance requests and Steam link challenges, after they expired. */
export const REQUEST_RETENTION_MS = DAY_MS
/** A posted League link's message reference (`leagueMessageRefs.expiresAt`). */
export const LEAGUE_MESSAGE_REF_TTL_MS = 14 * DAY_MS

export type RetentionCutoffs = {
    /** Rows written before this time are past the 30-day history window. */
    history: number
    historyIso: string
    /** Requests that expired before this time are past their day of grace. */
    request: number
    requestIso: string
    /** League message references posted before this time have expired. */
    leagueMessageRef: number
}

export function retentionCutoffs(now: number): RetentionCutoffs {
    const history = now - HISTORY_RETENTION_MS
    const request = now - REQUEST_RETENTION_MS
    return {
        history,
        historyIso: new Date(history).toISOString(),
        request,
        requestIso: new Date(request).toISOString(),
        leagueMessageRef: now - LEAGUE_MESSAGE_REF_TTL_MS,
    }
}

/**
 * Whether the rows a match keeps about its preparation (sign-up activity,
 * roster change requests) may go: only once the match is gone or ended
 * before the history window. A match planned far ahead keeps its old rows,
 * because the sign-up list dates each player by their sign-up activity and
 * the match's first change digest is the baseline of every later one. A
 * match with an unreadable end time keeps them too.
 */
export function matchHistoryExpired(
    event: { gameEnd: string } | null,
    historyCutoff: number
): boolean {
    if (!event) return true
    const end = Date.parse(event.gameEnd)
    return Number.isFinite(end) && end < historyCutoff
}

/**
 * Whether the bot still owes Discord the last state of a seed call: the
 * outbox row's request revision is ahead of what the bot delivered. Such a
 * run and its outbox row stay, because `discordSeedBot:deliveryState` draws
 * the call from the run until it is delivered.
 */
export function seedCallPending(
    outbox: { revision: number; deliveredRevision: number } | null
): boolean {
    return outbox !== null && outbox.revision > outbox.deliveredRevision
}

/** The expiry a new League message reference is stored with. */
export function leagueMessageRefExpiry(postedAt: number): number {
    return postedAt + LEAGUE_MESSAGE_REF_TTL_MS
}
