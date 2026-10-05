import { matchesGameScope, resolveGameScope, type GameId } from "../games/game"
import { resultSummaryPayloadSchema } from "../api/result-summaries"
import { isSignupMembershipAllowed } from "../events/signup-policy"
import { getResolvedMemberStatus } from "../assignments/policy"
import type { SignupMembershipStatus } from "../events/types"
import { currentEventStatus } from "../events/status"

/** What the clan overview needs from an event; extra stored fields are ignored. */
export type OverviewEvent = {
    id: string
    name: string
    gameId?: GameId
    kind?: "match" | "training"
    status?: "registration" | "closed" | "starting" | "concluded"
    registrationEnd: string
    meetingStart: string
    gameStart: string
    gameEnd: string
    requiredRoleIds?: string[]
    allowedSignupStatuses?: SignupMembershipStatus[]
    participants: Array<{
        userId: string
        status: "attending" | "not_attending"
    }>
    eventResult?: {
        endedAt?: string
        outcome: "victory" | "defeat" | "draw"
    }
    /** Storage head of the reviewed result; validated before it is trusted. */
    reviewedResult?: unknown
    reviewedResultGameId?: unknown
}

export type OverviewAssignment = {
    userId: string
    gameId?: GameId
    type: "member" | "reserve_member" | "mercenary"
    status: "pending" | "recruit" | "active"
    paused: boolean
    createdAt: string
}

export type OverviewRoster = {
    eventId: string
    published: boolean
    squads: Array<{
        players: Array<{ id?: string; customName?: string }>
    }>
}

/** Milliseconds of an ISO timestamp; NaN when missing or invalid. */
const time = (value: string | undefined) =>
    value ? new Date(value).getTime() : Number.NaN

/** The next match that has not been concluded, by start time. */
export function nextUpcomingMatch<T extends OverviewEvent>(
    events: readonly T[],
    now: Date
): T | null {
    return (
        events
            .filter(
                (event) =>
                    (event.kind ?? "match") === "match" &&
                    Number.isFinite(time(event.gameStart)) &&
                    currentEventStatus(event, now) !== "concluded"
            )
            .sort((a, b) => time(a.gameStart) - time(b.gameStart))[0] ?? null
    )
}

/** Filled and total roster places; null when there is no roster or it has no places. */
export function rosterFill(roster: OverviewRoster | null | undefined) {
    if (!roster) return null
    let filled = 0
    let total = 0
    for (const squad of roster.squads) {
        for (const player of squad.players) {
            total += 1
            if (player.id || player.customName?.trim()) filled += 1
        }
    }
    return total ? { filled, total } : null
}

/**
 * Sign-ups for a match and the members who have not answered yet. Members are
 * the clan's assignments for the match's game whose membership may sign up
 * (`isSignupMembershipAllowed`); paused members and applicants are not asked.
 * `unanswered` is null when the match also requires Discord roles, which the
 * dashboard cannot check per member.
 */
export function signupSummary(
    event: OverviewEvent,
    assignments: readonly OverviewAssignment[]
) {
    const responded = new Set(
        event.participants.map((participant) => participant.userId)
    )
    const signedUp = event.participants.filter(
        (participant) => participant.status === "attending"
    ).length
    if (event.requiredRoleIds?.length) return { signedUp, unanswered: null }

    const gameId = resolveGameScope(event.gameId)
    const waiting = new Set<string>()
    for (const assignment of assignments) {
        if (assignment.paused || responded.has(assignment.userId)) continue
        if (!matchesGameScope(assignment.gameId, gameId)) continue
        const status = getResolvedMemberStatus(
            assignment.type,
            assignment.status
        )
        if (status === "pending") continue
        if (
            !isSignupMembershipAllowed({
                event: {
                    kind: "match",
                    allowedSignupStatuses: event.allowedSignupStatuses,
                },
                membershipStatus: status,
            })
        )
            continue
        waiting.add(assignment.userId)
    }
    return { signedUp, unanswered: waiting.size }
}

function reviewedResult(event: OverviewEvent) {
    if (event.reviewedResultGameId !== resolveGameScope(event.gameId))
        return null
    const parsed = resultSummaryPayloadSchema.safeParse(event.reviewedResult)
    return parsed.success ? parsed.data : null
}

/**
 * The clan's last matches with a known outcome, oldest first. A match whose
 * reviewed result still waits for confirmation is marked `pending`.
 */
export function recentForm(events: readonly OverviewEvent[], limit = 10) {
    const matches = events
        .flatMap((event) =>
            (event.kind ?? "match") === "match" && event.eventResult
                ? [
                      {
                          eventId: event.id,
                          name: event.name,
                          outcome: event.eventResult.outcome,
                          endedAt: event.eventResult.endedAt ?? event.gameEnd,
                          pending:
                              reviewedResult(event)?.status === "provisional",
                      },
                  ]
                : []
        )
        .filter((match) => Number.isFinite(time(match.endedAt)))
        .sort((a, b) => time(b.endedAt) - time(a.endedAt))
        .slice(0, limit)
        .reverse()
    return {
        matches,
        wins: matches.filter((match) => match.outcome === "victory").length,
    }
}

/** Matches whose staged result waits for a manager's confirmation, newest first. */
export function resultsAwaitingConfirmation(events: readonly OverviewEvent[]) {
    return events
        .flatMap((event) => {
            const result = reviewedResult(event)
            if (result?.status !== "provisional") return []
            const [first, second, ...others] = result.participants
            return [
                {
                    eventId: event.id,
                    name: event.name,
                    gameEnd: event.gameEnd,
                    score:
                        !others.length &&
                        typeof first?.score === "number" &&
                        typeof second?.score === "number"
                            ? { sideA: first.score, sideB: second.score }
                            : null,
                },
            ]
        })
        .sort((a, b) => time(b.gameEnd) - time(a.gameEnd))
}

/** Applications waiting for a decision, with the oldest one's date. */
export function pendingApplications(
    assignments: readonly OverviewAssignment[]
) {
    const pending = assignments.filter(
        (assignment) => assignment.status === "pending"
    )
    const oldest = pending
        .map((assignment) => assignment.createdAt)
        .filter((createdAt) => Number.isFinite(time(createdAt)))
        .sort((a, b) => time(a) - time(b))[0]
    return { count: pending.length, oldestAt: oldest ?? null }
}

/** `count` calendar days from a `YYYY-MM-DD` key, independent of time zones. */
export function calendarDayKeys(firstDayKey: string, count = 7) {
    const [year, month, day] = firstDayKey.split("-").map(Number)
    const start = Date.UTC(year, month - 1, day)
    if (!Number.isFinite(start)) return []
    return Array.from({ length: count }, (_, index) =>
        new Date(start + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    )
}

/** Whole days from one `YYYY-MM-DD` key to another. */
export function calendarDayDistance(fromKey: string, toKey: string) {
    const [first] = calendarDayKeys(fromKey, 1)
    const [second] = calendarDayKeys(toKey, 1)
    if (!first || !second) return Number.NaN
    return Math.round(
        (Date.parse(`${second}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) /
            (24 * 60 * 60 * 1000)
    )
}

/** Events grouped under the given day keys, each day sorted by start time. */
export function eventsByDay<T extends { gameStart: string }>(
    events: readonly T[],
    dayKeys: readonly string[],
    dayKeyOf: (iso: string) => string
) {
    const days = new Map<string, T[]>(dayKeys.map((key) => [key, []]))
    for (const event of events) {
        days.get(dayKeyOf(event.gameStart))?.push(event)
    }
    return dayKeys.map((key) => ({
        key,
        events: (days.get(key) ?? []).sort(
            (a, b) => time(a.gameStart) - time(b.gameStart)
        ),
    }))
}
