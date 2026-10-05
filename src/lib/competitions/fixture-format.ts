import type {
    CompetitionFixtureView,
    CompetitionTeamView,
} from "@/domain/competitions/admin-view"

/**
 * Compact fixture texts for the administration list (design I3), in the
 * viewer's locale and time zone: "so 18:00" for an upcoming match,
 * "ne 4. 10." for a played one and "17. 10. – 18. 10." for a round.
 */

const valid = (iso: string | null): Date | null => {
    if (!iso) return null
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? null : date
}

/** The short label of a side: its short code, else its name. */
export const sideLabel = (
    team: Pick<CompetitionTeamView, "name" | "shortCode">
) => team.shortCode || team.name

/** "VLK vs MNT", or "VLK 3 : 2 DEF" once both scores are known. */
export function fixtureTitle(
    fixture: Pick<
        CompetitionFixtureView,
        "sideA" | "sideB" | "scoreA" | "scoreB"
    >
): { a: string; b: string; score: string | null } {
    return {
        a: sideLabel(fixture.sideA),
        b: sideLabel(fixture.sideB),
        score:
            fixture.scoreA !== null && fixture.scoreB !== null
                ? `${fixture.scoreA} : ${fixture.scoreB}`
                : null,
    }
}

/** Weekday and time for an upcoming fixture, weekday and date for a played one. */
export function fixtureWhen(
    iso: string | null,
    played: boolean,
    locale: string,
    timeZone?: string
): string | null {
    const date = valid(iso)
    if (!date) return null
    return new Intl.DateTimeFormat(
        locale,
        played
            ? { weekday: "short", day: "numeric", month: "numeric", timeZone }
            : { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone }
    ).format(date)
}

/** The days a round spans; a single day when it starts and ends on one. */
export function roundDays(
    from: string | null,
    to: string | null,
    locale: string,
    timeZone?: string
): string | null {
    const start = valid(from)
    if (!start) return null
    const end = valid(to) ?? start
    const format = new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "numeric",
        timeZone,
    })
    const first = format.format(start),
        last = format.format(end < start ? start : end)
    return first === last ? first : `${first} – ${last}`
}

/** Date and time of a candidate match ("ne 18. 10. 20:00"). */
export function candidateWhen(
    iso: string,
    locale: string,
    timeZone?: string
): string {
    const date = valid(iso)
    if (!date) return iso
    return new Intl.DateTimeFormat(locale, {
        weekday: "short",
        day: "numeric",
        month: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
    }).format(date)
}
