import type { ProviderSession } from "./contracts"

/**
 * The rules of the retained Warcon history, as plain predicates. `history.ts`
 * builds its Zod schema on them for the website; the history commit, which
 * the collector cron runs every few seconds, checks them directly without
 * loading Zod (ARCHITECTURE.md, "Convex hot paths").
 */
const DIGEST = /^[a-f0-9]{64}$/
const ID = /^\d{1,20}$/

/** A session that may be archived: complete, consistent times, unique players and factions, a winner the factions name. */
export function isRetainedWarconSession(session: ProviderSession): boolean {
    return (
        session.complete &&
        session.startedAt !== null &&
        session.endedAt !== null &&
        Date.parse(session.endedAt) >= Date.parse(session.startedAt) &&
        session.warcon !== undefined &&
        new Set(
            session.players.map(
                (player) => `${player.platform}:${player.platformId}`
            )
        ).size === session.players.length &&
        new Set(session.participants.map((faction) => faction.id)).size ===
            session.participants.length &&
        (session.warcon.winner === null ||
            session.participants.length === 0 ||
            session.participants.some(
                (faction) => faction.id === session.warcon!.winner
            ))
    )
}

/** The size limits `providerSessionSchema` puts on a collected session. */
export function isProviderSessionWithinLimits(
    session: ProviderSession
): boolean {
    return (
        session.externalId.length >= 1 &&
        session.externalId.length <= 100 &&
        DIGEST.test(session.sourceDigest) &&
        (session.map === null || session.map.length <= 200) &&
        session.participants.length <= 16 &&
        session.players.length <= 300 &&
        [session.startedAt, session.endedAt].every(
            (at) => at === null || Number.isFinite(Date.parse(at))
        )
    )
}

/** The page bookkeeping of a history run, within the ranges the collector may ask for. */
export function isHistoryProgress(progress: {
    page: number
    pendingIds: string[]
    nextPage: number | null
}): boolean {
    const page = (value: number) =>
        Number.isInteger(value) && value >= 1 && value <= 1_000_000
    return (
        page(progress.page) &&
        (progress.nextPage === null || page(progress.nextPage)) &&
        progress.pendingIds.length <= 50 &&
        progress.pendingIds.every((id) => ID.test(id))
    )
}
