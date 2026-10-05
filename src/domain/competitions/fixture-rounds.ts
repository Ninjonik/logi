import type {
    CompetitionFixtureView,
    FixtureEventCandidate,
} from "./admin-view"
import { FIXTURE_PHASES, type FixturePhase } from "./competition"

/**
 * Global-administration fixture list (design I3): one division and phase at
 * a time, grouped by round, each fixture with the one state its row shows.
 */

/** Fixtures of one round; `round: null` collects fixtures saved without one. */
export type FixtureRoundGroup = {
    round: number | null
    fixtures: CompetitionFixtureView[]
    /** Earliest and latest scheduled instants in the round, if any are scheduled. */
    from: string | null
    to: string | null
}

const byTime = (a: CompetitionFixtureView, b: CompetitionFixtureView) =>
    (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "") ||
    a.id.localeCompare(b.id)

/**
 * The fixtures of a division (`null` for every division) and phase, grouped
 * by round: the latest round first, fixtures without a round last; inside a
 * round by scheduled time.
 */
export function groupFixturesByRound(
    fixtures: readonly CompetitionFixtureView[],
    filter: { divisionId: string | null; phase: FixturePhase }
): FixtureRoundGroup[] {
    const groups = new Map<number | null, CompetitionFixtureView[]>()
    for (const fixture of fixtures) {
        if (fixture.phase !== filter.phase) continue
        if (
            filter.divisionId !== null &&
            fixture.divisionId !== filter.divisionId
        )
            continue
        const round = fixture.round ?? null
        const list = groups.get(round) ?? []
        list.push(fixture)
        groups.set(round, list)
    }
    return [...groups.entries()]
        .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : b - a))
        .map(([round, list]) => {
            const sorted = [...list].sort(byTime)
            const times = sorted
                .map((fixture) => fixture.scheduledAt)
                .filter((value): value is string => Boolean(value))
                .sort()
            return {
                round,
                fixtures: sorted,
                from: times[0] ?? null,
                to: times.at(-1) ?? null,
            }
        })
}

/** The phase shown first: league when the division has league fixtures, else the first phase that has any. */
export function defaultFixturePhase(
    fixtures: readonly CompetitionFixtureView[],
    divisionId: string | null
): FixturePhase {
    const used = new Set(
        fixtures
            .filter(
                (fixture) =>
                    divisionId === null || fixture.divisionId === divisionId
            )
            .map((fixture) => fixture.phase)
    )
    return FIXTURE_PHASES.find((phase) => used.has(phase)) ?? "league"
}

/**
 * What a fixture row shows: a scheduled fixture is linked to a clan's match
 * or offers linking; a result imported from a clan's match waits until the
 * clan confirms it; other results are played or forfeited.
 */
export type FixtureRowState =
    "linked" | "unlinked" | "awaiting_confirmation" | "played" | "forfeit"

export function fixtureRowState(
    fixture: Pick<CompetitionFixtureView, "status" | "event">
): FixtureRowState {
    if (fixture.status === "forfeit") return "forfeit"
    if (fixture.status === "final")
        return fixture.event?.hasResult && !fixture.event.reviewed
            ? "awaiting_confirmation"
            : "played"
    return fixture.event ? "linked" : "unlinked"
}

/** The round a new fixture starts with: the latest round listed, or 1. */
export function suggestedRound(groups: readonly FixtureRoundGroup[]): number {
    return groups.find((group) => group.round !== null)?.round ?? 1
}

const distance = (value: string, target: number) =>
    Math.abs(new Date(value).getTime() - target)

/**
 * Link candidates matching the search (by name, case-insensitive), both
 * fixture teams assigned first, then nearest the fixture's time (newest
 * first when the fixture has none).
 */
export function rankLinkCandidates(
    candidates: readonly FixtureEventCandidate[],
    input: { scheduledAt: string | null; search: string }
): FixtureEventCandidate[] {
    const needle = input.search.trim().toLocaleLowerCase()
    const target = input.scheduledAt
        ? new Date(input.scheduledAt).getTime()
        : Number.NaN
    return candidates
        .filter(
            (candidate) =>
                !needle ||
                candidate.name.toLocaleLowerCase().includes(needle) ||
                candidate.workspace.toLocaleLowerCase().includes(needle)
        )
        .sort(
            (a, b) =>
                Number(b.teamsMatch) - Number(a.teamsMatch) ||
                (Number.isNaN(target)
                    ? b.gameStart.localeCompare(a.gameStart)
                    : distance(a.gameStart, target) -
                      distance(b.gameStart, target)) ||
                a.id.localeCompare(b.id)
        )
}
