import type { EventKind, EventStatus } from "./types"
import { currentEventStatus } from "./status"

/** What the match list needs from an event. */
export type MatchListEvent = {
    id: string
    kind: EventKind
    status: EventStatus
    registrationEnd: string
    meetingStart: string
    gameStart: string
    gameEnd: string
    participants: ReadonlyArray<{
        status: "attending" | "not_attending"
        completed?: "passed" | "failed"
    }>
    eventResult?: {
        outcome: "victory" | "defeat" | "draw"
        score: { sideA: number; sideB: number }
    }
}

/** What the match list needs from a roster. */
export type MatchListRoster = {
    eventId: string
    published: boolean
    squads: ReadonlyArray<{
        players: ReadonlyArray<{
            id?: string
            customName?: string
            ack: boolean
        }>
    }>
}

/**
 * Where an event stands and what is missing, in the order an organiser works
 * through it: sign-ups, roster, then the result or training outcome.
 */
export type MatchPhase =
    | { kind: "registration"; closesAt: string }
    | { kind: "registrationClosed" }
    | { kind: "rosterMissing" }
    | { kind: "rosterDraft"; openSlots: number }
    | { kind: "rosterPublished"; unconfirmed: number }
    | { kind: "awaitingResult" }
    | {
          kind: "result"
          outcome: "victory" | "defeat" | "draw"
          score: { sideA: number; sideB: number }
      }
    | { kind: "trainingCompleted"; passed: number; failed: number }
    | { kind: "concluded" }

function rosterCounts(roster: MatchListRoster) {
    let openSlots = 0
    let unconfirmed = 0
    for (const squad of roster.squads) {
        for (const player of squad.players) {
            if (!player.id && !player.customName?.trim()) openSlots += 1
            else if (player.id && !player.ack) unconfirmed += 1
        }
    }
    return { openSlots, unconfirmed }
}

export function attendingCount(event: Pick<MatchListEvent, "participants">) {
    return event.participants.filter(
        (participant) => participant.status === "attending"
    ).length
}

export function isPlayed(event: MatchListEvent, now: Date) {
    return currentEventStatus(event, now) === "concluded"
}

export function matchListPhase(
    event: MatchListEvent,
    roster: MatchListRoster | undefined,
    now: Date
): MatchPhase {
    const status = currentEventStatus(event, now) ?? event.status
    if (status === "concluded") {
        if (event.kind === "training") {
            const passed = event.participants.filter(
                (participant) => participant.completed === "passed"
            ).length
            const failed = event.participants.filter(
                (participant) => participant.completed === "failed"
            ).length
            return passed + failed > 0
                ? { kind: "trainingCompleted", passed, failed }
                : { kind: "concluded" }
        }
        return event.eventResult
            ? {
                  kind: "result",
                  outcome: event.eventResult.outcome,
                  score: event.eventResult.score,
              }
            : { kind: "awaitingResult" }
    }
    if (status === "registration")
        return { kind: "registration", closesAt: event.registrationEnd }
    if (event.kind === "training") return { kind: "registrationClosed" }
    if (!roster) return { kind: "rosterMissing" }
    const counts = rosterCounts(roster)
    return roster.published
        ? { kind: "rosterPublished", unconfirmed: counts.unconfirmed }
        : { kind: "rosterDraft", openSlots: counts.openSlots }
}

/** A task for the organiser at the top of the match list. */
export type MatchQueueItem =
    | {
          kind: "publishRoster"
          eventId: string
          gameStart: string
          signedUp: number
          openSlots?: number
      }
    | {
          kind: "confirmAttendance"
          eventId: string
          gameStart: string
          unconfirmed: number
      }

/**
 * Matches whose sign-ups have closed but whose roster is not published yet,
 * and published rosters with players who have not confirmed, soonest first.
 */
export function matchListQueue(
    events: readonly MatchListEvent[],
    rosters: readonly MatchListRoster[],
    now: Date,
    limit = 6
): MatchQueueItem[] {
    const rosterByEvent = new Map(
        rosters.map((roster) => [roster.eventId, roster])
    )
    const items: MatchQueueItem[] = []
    for (const event of events) {
        if (event.kind !== "match") continue
        const phase = matchListPhase(event, rosterByEvent.get(event.id), now)
        if (phase.kind === "rosterMissing" || phase.kind === "rosterDraft")
            items.push({
                kind: "publishRoster",
                eventId: event.id,
                gameStart: event.gameStart,
                signedUp: attendingCount(event),
                openSlots:
                    phase.kind === "rosterDraft" ? phase.openSlots : undefined,
            })
        else if (phase.kind === "rosterPublished" && phase.unconfirmed > 0)
            items.push({
                kind: "confirmAttendance",
                eventId: event.id,
                gameStart: event.gameStart,
                unconfirmed: phase.unconfirmed,
            })
    }
    return items
        .sort(
            (left, right) =>
                Date.parse(left.gameStart) - Date.parse(right.gameStart)
        )
        .slice(0, limit)
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Days since 1970-01-01 of the calendar date of `iso` in `timeZone`. */
export function localDayNumber(iso: string, timeZone: string) {
    let format: Intl.DateTimeFormat
    try {
        format = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        })
    } catch {
        // An unknown stored time zone falls back to UTC instead of failing the page.
        format = new Intl.DateTimeFormat("en-CA", {
            timeZone: "UTC",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        })
    }
    const parts = format.formatToParts(new Date(iso))
    const part = (type: string) =>
        Number(parts.find((item) => item.type === type)?.value)
    return Math.round(
        Date.UTC(part("year"), part("month") - 1, part("day")) / DAY_MS
    )
}

/** The Monday that starts the week of a day number (1970-01-01 was a Thursday). */
function weekStartDay(dayNumber: number) {
    return dayNumber - ((dayNumber + 3) % 7)
}

/**
 * Whole weeks between the clan-local week of `iso` and the current week:
 * 0 is this week, 1 next week, -1 last week. Weeks start on Monday.
 */
export function weekOffset(iso: string, now: Date, timeZone: string) {
    return Math.round(
        (weekStartDay(localDayNumber(iso, timeZone)) -
            weekStartDay(localDayNumber(now.toISOString(), timeZone))) /
            7
    )
}

/** ISO date (UTC midnight) of the Monday that starts the week of `iso` in `timeZone`. */
export function weekStartDate(iso: string, timeZone: string) {
    return new Date(
        weekStartDay(localDayNumber(iso, timeZone)) * DAY_MS
    ).toISOString()
}

/** Groups items by week in the order given, keeping each item's order. */
export function groupByWeek<T>(
    items: readonly T[],
    getDate: (item: T) => string,
    now: Date,
    timeZone: string
) {
    const groups: Array<{ offset: number; weekStart: string; items: T[] }> = []
    for (const item of items) {
        const offset = weekOffset(getDate(item), now, timeZone)
        const last = groups.at(-1)
        if (last && last.offset === offset) last.items.push(item)
        else
            groups.push({
                offset,
                weekStart: weekStartDate(getDate(item), timeZone),
                items: [item],
            })
    }
    return groups
}
