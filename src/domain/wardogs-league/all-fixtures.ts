import { CACHE_MS, type LeagueMatch } from "./contracts"

/**
 * The whole League, not only the clan's matches (P6-14, P6-B01): every match
 * the public index lists is collected once into a shared, guild-independent
 * fixture store, classified into a phase and refreshed at a cadence that
 * follows the phase.
 */
export const INDEX_TABS = ["fixtures", "results"] as const
export type IndexTab = (typeof INDEX_TABS)[number]

export const FIXTURE_PHASES = [
    "upcoming",
    "live",
    "completed",
    "cancelled",
] as const
export type FixturePhase = (typeof FIXTURE_PHASES)[number]

/** Bound of the shared all-League fixture store: the 500-link index plus fixtures that
 * dropped off it but are still retained. Admission reads the whole store at once. */
export const MAX_LEAGUE_FIXTURES = 600
/** Upcoming fixtures refreshed at the fastest cadence: the largest panel count. */
export const PANEL_WINDOW = 10
/** A kickoff this far in the past still counts as "upcoming" when the League is late. */
export const LATE_KICKOFF_GRACE_MS = 3 * 3600_000
/** A match still "Live" this long after kickoff is treated as a stale page. */
export const LIVE_WINDOW_MS = 12 * 3600_000
/** Fixture refresh cadences; the shared five-minute detail cache bounds the fastest one. */
export const FIXTURE_REFRESH_MS = {
    window: CACHE_MS,
    distant: 30 * 60_000,
    awaitingResult: 30 * 60_000,
    settling: 6 * 3600_000,
} as const
/** Placements that have not appeared by then are not waited for any more. */
export const RESULT_HORIZON_MS = 14 * 86_400_000
/** Confirmed placements are re-checked for corrections this long. */
export const SETTLED_RESULT_MS = 7 * 86_400_000
/** Completed and cancelled fixtures are dropped from the store after this. */
export const FIXTURE_RETENTION_MS = 30 * 86_400_000
/** `nextRefreshAt` of a fixture that no longer needs reading. */
export const NEVER = 8_640_000_000_000_000
/** A shown fixture is stale after missing about three refreshes or on a failed read. */
export const FIXTURE_STALE_MS = 3 * CACHE_MS
/** Fenced lease of one fixture read. */
export const FIXTURE_LEASE_MS = 30_000
/** Fixture reads per collection run; with the index and tracked reads it stays
 * inside the shared budget of 20 League fetches per minute. */
export const FIXTURE_READS_PER_RUN = 6

export function fixtureStale(input: {
    fetchedAt: string
    error: string | null
    now: number
}) {
    return (
        input.error !== null ||
        input.now - Date.parse(input.fetchedAt) >= FIXTURE_STALE_MS
    )
}

const step = (match: Pick<LeagueMatch, "progress">, label: string) =>
    match.progress?.find(
        (entry) => entry.label.toLowerCase() === label.toLowerCase()
    ) ?? null

/**
 * Phase of a fixture from its parsed page and the index tab that listed it.
 * Published placements win, then the League status label, then the progress
 * steps, then the tab. Only "Scheduled" pages are verified against real HTML;
 * the other labels follow the parser's recognised vocabulary.
 */
export function fixturePhase(
    match: Pick<LeagueMatch, "status" | "progress" | "results"> | null,
    tab: IndexTab | null
): FixturePhase {
    if (match?.results) return "completed"
    const status = match?.status?.toLowerCase().replace(/[\s_-]+/g, " ")
    if (status && /^(cancelled|canceled|no show)$/.test(status))
        return "cancelled"
    if (status && /^(completed|finished|confirmed|disputed)$/.test(status))
        return "completed"
    if (status === "live") return "live"
    if (match) {
        const confirmed = step(match, "Confirmed")
        const placements = step(match, "Placements")
        const live = step(match, "Live")
        if (
            confirmed?.state === "done" ||
            placements?.state === "done" ||
            placements?.state === "current" ||
            live?.state === "done"
        )
            return "completed"
        if (live?.state === "current") return "live"
    }
    return tab === "results" ? "completed" : "upcoming"
}

export const FIXTURE_CHANGES = [
    "discovered",
    "schedule",
    "teams",
    "map",
    "hosting",
    "preparation",
    "status",
    "result",
] as const
export type FixtureChange = (typeof FIXTURE_CHANGES)[number]

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * What changed between two reads of one fixture. "result" drives the table
 * and recent results refresh (P6-B06); the rest marks a changed fixture.
 */
export function fixtureChanges(
    previous: LeagueMatch | null,
    next: LeagueMatch
): FixtureChange[] {
    if (!previous)
        return next.results ? ["discovered", "result"] : ["discovered"]
    const changes: FixtureChange[] = []
    if (previous.scheduledAt !== next.scheduledAt) changes.push("schedule")
    if (
        !same(
            previous.teams?.map((t) => [t.code, t.name, t.faction]),
            next.teams?.map((t) => [t.code, t.name, t.faction])
        )
    )
        changes.push("teams")
    if (!same(previous.map, next.map)) changes.push("map")
    if (!same(previous.hosting, next.hosting)) changes.push("hosting")
    if (
        !same(
            [
                previous.rules,
                previous.mapVote,
                previous.moderator,
                previous.readyCheck,
                previous.progress,
                previous.teams?.map((t) => t.readyCheck),
            ],
            [
                next.rules,
                next.mapVote,
                next.moderator,
                next.readyCheck,
                next.progress,
                next.teams?.map((t) => t.readyCheck),
            ]
        )
    )
        changes.push("preparation")
    if (previous.status !== next.status) changes.push("status")
    if (!same(previous.results, next.results)) changes.push("result")
    return changes
}

/**
 * When the fixture should be read again, or `null` when it is settled.
 * Live and the nearest upcoming fixtures follow the shared cache (5 min);
 * the panels themselves redraw every 60 s from stored data.
 */
export function nextFixtureRefreshAt(input: {
    phase: FixturePhase
    scheduledAt: number | null
    firstSeenAt: number
    hasResult: boolean
    resultConfirmed: boolean
    inWindow: boolean
    now: number
}): number | null {
    const { now } = input
    const anchor = input.scheduledAt ?? input.firstSeenAt
    switch (input.phase) {
        case "live":
            // A page stuck on "Live" long after kickoff is not polled forever.
            if (
                input.scheduledAt !== null &&
                now > input.scheduledAt + LIVE_WINDOW_MS
            )
                return now < anchor + RESULT_HORIZON_MS
                    ? now + FIXTURE_REFRESH_MS.settling
                    : null
            return now + FIXTURE_REFRESH_MS.window
        case "upcoming":
            return (
                now +
                (input.inWindow ||
                (input.scheduledAt !== null &&
                    input.scheduledAt - now <= 86_400_000)
                    ? FIXTURE_REFRESH_MS.window
                    : FIXTURE_REFRESH_MS.distant)
            )
        case "cancelled":
            return now < anchor + 86_400_000
                ? now + FIXTURE_REFRESH_MS.settling
                : null
        case "completed":
            if (input.hasResult && input.resultConfirmed)
                return now < anchor + SETTLED_RESULT_MS
                    ? now + FIXTURE_REFRESH_MS.settling
                    : null
            if (now >= anchor + RESULT_HORIZON_MS) return null
            return (
                now +
                (input.hasResult || now < anchor + 2 * 86_400_000
                    ? FIXTURE_REFRESH_MS.awaitingResult
                    : FIXTURE_REFRESH_MS.settling)
            )
    }
}

/** Whether a stored fixture may be removed from the shared store. */
export function fixtureExpired(input: {
    phase: FixturePhase
    scheduledAt: number | null
    firstSeenAt: number
    listed: boolean
    now: number
}) {
    if (input.listed) return false
    const anchor = input.scheduledAt ?? input.firstSeenAt
    return input.phase === "completed" || input.phase === "cancelled"
        ? input.now >= anchor + FIXTURE_RETENTION_MS
        : input.now >= anchor + RESULT_HORIZON_MS &&
              input.now >= input.firstSeenAt + RESULT_HORIZON_MS
}

export type FixtureOrderItem = {
    matchId: string
    phase: FixturePhase
    scheduledAt: string | null
    fixtureNumber: number | null
}

/**
 * The nearest fixtures for "nejbližší zápasy" (P6-21, P6-B04): live ones
 * first, then upcoming by kickoff; a fixture whose kickoff passed more than
 * three hours ago without a live or final state is no longer "upcoming", and
 * one still "Live" twelve hours after kickoff is a stale page. Fixtures
 * without a known kickoff come last.
 */
export function nearestFixtures<T extends FixtureOrderItem>(
    fixtures: readonly T[],
    now: number,
    count: number
): { shown: T[]; hidden: number; total: number } {
    const since = (fixture: T, window: number) =>
        fixture.scheduledAt === null ||
        Date.parse(fixture.scheduledAt) >= now - window
    const eligible = fixtures
        .filter(
            (fixture) =>
                (fixture.phase === "live" && since(fixture, LIVE_WINDOW_MS)) ||
                (fixture.phase === "upcoming" &&
                    since(fixture, LATE_KICKOFF_GRACE_MS))
        )
        .sort((a, b) => {
            if (a.phase !== b.phase) return a.phase === "live" ? -1 : 1
            const at = (value: string | null) =>
                value === null ? Number.POSITIVE_INFINITY : Date.parse(value)
            return (
                at(a.scheduledAt) - at(b.scheduledAt) ||
                (a.fixtureNumber ?? Number.MAX_SAFE_INTEGER) -
                    (b.fixtureNumber ?? Number.MAX_SAFE_INTEGER) ||
                a.matchId.localeCompare(b.matchId)
            )
        })
    const shown = eligible.slice(0, Math.max(0, count))
    return {
        shown,
        hidden: eligible.length - shown.length,
        total: eligible.length,
    }
}
