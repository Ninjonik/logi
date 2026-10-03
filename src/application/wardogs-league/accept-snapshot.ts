import {
    losesMatchStructure,
    type LeagueSnapshot,
} from "../../domain/wardogs-league/contracts"

/** The durable tracked copy must remain safe even after the shared fetch cache is evicted. */
export function selectTrackedSnapshot(
    previous: LeagueSnapshot | null,
    next: LeagueSnapshot | null
) {
    if (!next) return { snapshot: previous, rejected: false }
    if (
        previous &&
        (Date.parse(next.fetchedAt) < Date.parse(previous.fetchedAt) ||
            losesMatchStructure(previous, next))
    )
        return { snapshot: previous, rejected: true }
    return { snapshot: next, rejected: false }
}
