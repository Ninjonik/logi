/**
 * One match of a player's history together with the older matches used for
 * the "compared with the previous matches" averages and trend charts.
 *
 * `matches` must be ordered newest first. The lookup covers the whole history,
 * so a match beyond any display limit of the player profile still resolves.
 */
export function selectPlayerMatchWindow<T extends { eventId: string }>(
    matches: readonly T[],
    eventId: string,
    previousCount: number
): { match: T; previous: T[] } | null {
    const index = matches.findIndex((item) => item.eventId === eventId)
    if (index < 0) return null
    const limit = Math.max(0, Math.floor(previousCount))
    return {
        match: matches[index]!,
        previous: matches
            .slice(index + 1)
            .filter((item) => item.eventId !== eventId)
            .slice(0, limit),
    }
}
