import type { PublicCompetitionFixture } from "./competition"
import { splitPublicFixtures } from "./public-fixtures"

/**
 * A fixture's round, when the competition records one: a positive whole
 * number ("3. kolo") or a short label. Fixtures without a round are grouped by
 * week instead. The field is optional and may be missing from older records
 * and deployments, so it is read without assuming it exists.
 */
export function fixtureRound(
    fixture: PublicCompetitionFixture
): number | string | null {
    const value: unknown = "round" in fixture ? fixture.round : undefined
    if (typeof value === "number")
        return Number.isInteger(value) && value > 0 ? value : null
    if (typeof value === "string") {
        const label = value.trim()
        return label ? label : null
    }
    return null
}

const DAY = 24 * 60 * 60 * 1000

/** Monday 00:00 UTC of the week `time` falls in. */
export function weekStartUtc(time: number): number {
    const day = new Date(time)
    const midnight = Date.UTC(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate()
    )
    return midnight - ((day.getUTCDay() + 6) % 7) * DAY
}

export type PublicFixtureGroup = {
    key: string
    /** The round all fixtures of the group share, or `null` for a week group. */
    round: number | string | null
    /** Earliest and latest scheduled time in the group; `null` when undated. */
    first: string | null
    last: string | null
    fixtures: PublicCompetitionFixture[]
}

function groupFixtures(
    fixtures: readonly PublicCompetitionFixture[]
): PublicFixtureGroup[] {
    const groups = new Map<string, PublicFixtureGroup>()
    for (const fixture of fixtures) {
        const round = fixtureRound(fixture)
        const time = fixture.scheduledAt
            ? Date.parse(fixture.scheduledAt)
            : Number.NaN
        const key =
            round !== null
                ? `round:${round}`
                : Number.isNaN(time)
                  ? "undated"
                  : `week:${weekStartUtc(time)}`
        const group = groups.get(key) ?? {
            key,
            round,
            first: null,
            last: null,
            fixtures: [],
        }
        group.fixtures.push(fixture)
        if (!Number.isNaN(time) && fixture.scheduledAt) {
            if (!group.first || time < Date.parse(group.first))
                group.first = fixture.scheduledAt
            if (!group.last || time > Date.parse(group.last))
                group.last = fixture.scheduledAt
        }
        groups.set(key, group)
    }
    return [...groups.values()]
}

/**
 * The public page's fixture lists: scheduled fixtures by round (or week when
 * they have no round), soonest first, then played ones the same way, newest
 * first. Within a group the order of `splitPublicFixtures` is kept.
 */
export function groupPublicFixtures(
    fixtures: readonly PublicCompetitionFixture[]
): { upcoming: PublicFixtureGroup[]; results: PublicFixtureGroup[] } {
    const { upcoming, results } = splitPublicFixtures(fixtures)
    return {
        upcoming: groupFixtures(upcoming),
        results: groupFixtures(results),
    }
}

export type FixtureSpan =
    | { kind: "undated" }
    | { kind: "this_weekend" }
    | { kind: "this_week" }
    | { kind: "next_week" }
    | { kind: "range"; from: string; to: string }

/** How an upcoming group's dates relate to `now` (weeks start on Monday, UTC). */
export function describeFixtureSpan(
    group: Pick<PublicFixtureGroup, "first" | "last">,
    now: number
): FixtureSpan {
    if (!group.first || !group.last) return { kind: "undated" }
    const first = Date.parse(group.first)
    const last = Date.parse(group.last)
    const week = weekStartUtc(first)
    if (week === weekStartUtc(last)) {
        const current = weekStartUtc(now)
        if (week === current)
            // Saturday or Sunday: the rest of the week up to `last` is weekend too.
            return [0, 6].includes(new Date(first).getUTCDay())
                ? { kind: "this_weekend" }
                : { kind: "this_week" }
        if (week === current + 7 * DAY) return { kind: "next_week" }
    }
    return { kind: "range", from: group.first, to: group.last }
}

export type CompetitionView =
    { kind: "division"; divisionId: string } | { kind: "playoff" }

/** Query value of the play-off tab; division IDs are Convex IDs and never match it. */
export const PLAYOFF_VIEW = "playoff"

/** Whether any division has a play-off fixture, which adds the play-off tab. */
export function hasPlayoffFixtures(
    divisions: ReadonlyArray<{ fixtures: readonly PublicCompetitionFixture[] }>
): boolean {
    return divisions.some((division) =>
        division.fixtures.some((fixture) => fixture.phase === "playoff")
    )
}

/** The tab a public competition page shows: the requested one, else the first division. */
export function selectCompetitionView(
    divisions: ReadonlyArray<{
        id: string
        fixtures: readonly PublicCompetitionFixture[]
    }>,
    requested: string | undefined
): CompetitionView | null {
    const playoff = hasPlayoffFixtures(divisions)
    if (requested === PLAYOFF_VIEW && playoff) return { kind: "playoff" }
    const division =
        divisions.find((entry) => entry.id === requested) ?? divisions[0]
    if (division) return { kind: "division", divisionId: division.id }
    return playoff ? { kind: "playoff" } : null
}

/**
 * Fixtures of one tab. With a play-off tab, play-off fixtures move there from
 * their divisions; league and relegation fixtures stay in their division.
 */
export function fixturesForView(
    divisions: ReadonlyArray<{
        id: string
        fixtures: readonly PublicCompetitionFixture[]
    }>,
    view: CompetitionView
): PublicCompetitionFixture[] {
    if (view.kind === "playoff")
        return divisions.flatMap((division) =>
            division.fixtures.filter((fixture) => fixture.phase === "playoff")
        )
    return (
        divisions.find((division) => division.id === view.divisionId)
            ?.fixtures ?? []
    ).filter((fixture) => fixture.phase !== "playoff")
}
