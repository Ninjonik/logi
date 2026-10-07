/**
 * When a managed Discord message can be left alone. A panel renders every
 * minute, and most passes render exactly what Discord already shows; a
 * publish then only proves the message still exists. Convex stores a new
 * version of the `discordPublications` row on every write, so a publish
 * whose rendered hash is the stored one, in the same channel, at the same
 * revision and confirmed less than `PUBLICATION_RECHECK_MS` ago writes
 * nothing and asks Discord nothing; once the confirmation is older, the
 * next pass checks the message again (L3-B01 for the result cards, every
 * panel kind since).
 */

/** An unchanged message is checked in Discord again after this long. */
export const PUBLICATION_RECHECK_MS = 10 * 60_000

/** The stored state of one managed message, as `discordPublications` keeps it. */
export type StoredPublication = {
    revision: number
    channelId: string | null
    messageId: string | null
    pending: { channelId: string; marker: string } | null
    hash: string | null
    leaseUntil: number
    retryAt: number
    lastSuccessAt: number | null
    error: string | null
}

/**
 * Whether publishing `hash` to `channelId` at `revision` would change
 * nothing. A held lease, a retry wait, an unconfirmed create or a stored
 * error always publish, so the lease and the recovery of an uncertain create
 * work exactly as before. With no target the message is current when there
 * is nothing in Discord to remove.
 */
export function publicationIsCurrent(
    row: StoredPublication,
    input: {
        revision: number
        channelId: string | null
        hash: string
        now: number
    }
): boolean {
    if (
        row.pending ||
        row.error !== null ||
        row.leaseUntil > input.now ||
        row.retryAt > input.now ||
        row.revision !== input.revision ||
        row.channelId !== input.channelId
    )
        return false
    if (input.channelId === null) return row.messageId === null
    return (
        row.messageId !== null &&
        row.hash === input.hash &&
        row.lastSuccessAt !== null &&
        input.now - row.lastSuccessAt < PUBLICATION_RECHECK_MS
    )
}
