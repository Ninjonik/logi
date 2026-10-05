/** How far a server game may start from the match start and still match it. */
export const SESSION_MATCH_WINDOW_MS = 3 * 60 * 60 * 1000

/**
 * The collected server game that most likely is this match: the one starting
 * closest to the match start, within three hours. Complete records win ties.
 */
export function suggestResultSession<
    T extends { id: string; startedAt: string | null; complete: boolean },
>(sessions: readonly T[], matchStart: string): T | null {
    const target = new Date(matchStart).getTime()
    if (!Number.isFinite(target)) return null
    let best: { session: T; distance: number } | null = null
    for (const session of sessions) {
        const started = session.startedAt
            ? new Date(session.startedAt).getTime()
            : Number.NaN
        if (!Number.isFinite(started)) continue
        const distance = Math.abs(started - target)
        if (distance > SESSION_MATCH_WINDOW_MS) continue
        if (
            !best ||
            distance < best.distance ||
            (distance === best.distance &&
                session.complete &&
                !best.session.complete)
        )
            best = { session, distance }
    }
    return best?.session ?? null
}
