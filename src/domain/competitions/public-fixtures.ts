import type { PublicCompetitionFixture } from "./competition"

const time = (fixture: PublicCompetitionFixture) =>
    fixture.scheduledAt ? Date.parse(fixture.scheduledAt) : Number.NaN

/**
 * Splits a division's fixtures for the public page: scheduled ones soonest
 * first (undated last), played ones (final or forfeit) newest first
 * (undated last).
 */
export function splitPublicFixtures(
    fixtures: readonly PublicCompetitionFixture[]
): {
    upcoming: PublicCompetitionFixture[]
    results: PublicCompetitionFixture[]
} {
    const dated = (direction: 1 | -1) =>
        function compare(
            a: PublicCompetitionFixture,
            b: PublicCompetitionFixture
        ) {
            const left = time(a),
                right = time(b)
            if (Number.isNaN(left)) return Number.isNaN(right) ? 0 : 1
            if (Number.isNaN(right)) return -1
            return (left - right) * direction
        }
    return {
        upcoming: fixtures
            .filter((fixture) => fixture.status === "scheduled")
            .sort(dated(1)),
        results: fixtures
            .filter((fixture) => fixture.status !== "scheduled")
            .sort(dated(-1)),
    }
}

/** The division a public competition page shows: the requested one, else the first. */
export function selectedDivisionId(
    divisions: readonly { id: string }[],
    requested: string | undefined
): string | null {
    return (
        divisions.find((division) => division.id === requested)?.id ??
        divisions[0]?.id ??
        null
    )
}
