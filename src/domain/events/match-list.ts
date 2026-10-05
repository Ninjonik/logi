import type { EventKind, EventStatus } from "./types"
import { currentEventStatus } from "./status"

/** What the match list needs from an event. */
export type MatchListEvent = {
    id: string
    kind: EventKind
    status: EventStatus
    /** Saved from the new-match form but not published yet. */
    isDraft?: boolean
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
    /** Set when a manager closed the match and its attendance points. */
    scoreResolution?: "applied" | "skipped"
    scoreAppliedAt?: string
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

export type ResultReviewStatus = "provisional" | "confirmed" | "corrected"
export type ResultReviewOrigin = "collected" | "manual" | "legacy_import"

/** The newest reviewed-result revision of a match, as the list needs it. */
export type MatchListResultReview = {
    status: ResultReviewStatus
    origin: ResultReviewOrigin
    /** Scores in participant order; null when any participant has no score. */
    scores: number[] | null
}

/** Reduces a stored result head to its state and scores. */
export function toMatchListResultReview(head: {
    status: ResultReviewStatus
    origin: ResultReviewOrigin
    participants: ReadonlyArray<{ score: number | null }>
}): MatchListResultReview {
    const scores = head.participants.map((participant) => participant.score)
    return {
        status: head.status,
        origin: head.origin,
        scores:
            scores.length >= 2 &&
            scores.every(
                (score): score is number =>
                    typeof score === "number" && Number.isFinite(score)
            )
                ? scores
                : null,
    }
}

/**
 * Where an event stands and what is missing, in the order an organiser works
 * through it: sign-ups, roster, then the result or training outcome. A draft
 * is not published yet and has no other phase.
 */
export type MatchPhase =
    | { kind: "draft" }
    | { kind: "registration"; closesAt: string }
    | { kind: "registrationClosed" }
    | { kind: "rosterMissing" }
    | { kind: "rosterDraft"; openSlots: number }
    | { kind: "rosterPublished"; unconfirmed: number }
    | { kind: "awaitingResult" }
    | { kind: "resultPending"; scores: number[] | null }
    | {
          kind: "result"
          /** Null when a reviewed score no longer matches the imported outcome. */
          outcome: "victory" | "defeat" | "draw" | null
          scores: number[] | null
          /** Null for an imported result that was never reviewed. */
          review: "confirmed" | "corrected" | null
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

/** A draft is never played: it waits in the drafts tab until it is published. */
export function isPlayed(event: MatchListEvent, now: Date) {
    return !event.isDraft && currentEventStatus(event, now) === "concluded"
}

function sameScores(left: readonly number[], right: readonly number[]) {
    return (
        left.length === right.length &&
        left.every((score, index) => score === right[index])
    )
}

function matchResultPhase(
    event: MatchListEvent,
    review: MatchListResultReview | undefined
): MatchPhase {
    const imported = event.eventResult
        ? [event.eventResult.score.sideA, event.eventResult.score.sideB]
        : null
    if (review?.status === "provisional")
        return { kind: "resultPending", scores: review.scores ?? imported }
    if (review) {
        const scores = review.scores ?? imported
        // The imported outcome describes the imported score; a correction to
        // other numbers leaves the outcome unknown instead of guessing it.
        const outcome =
            event.eventResult &&
            imported &&
            (!review.scores || sameScores(review.scores, imported))
                ? event.eventResult.outcome
                : null
        return { kind: "result", outcome, scores, review: review.status }
    }
    if (event.eventResult)
        return {
            kind: "result",
            outcome: event.eventResult.outcome,
            scores: imported,
            review: null,
        }
    return { kind: "awaitingResult" }
}

export function matchListPhase(
    event: MatchListEvent,
    roster: MatchListRoster | undefined,
    now: Date,
    review?: MatchListResultReview
): MatchPhase {
    if (event.isDraft) return { kind: "draft" }
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
        return matchResultPhase(event, review)
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
          kind: "confirmResult"
          eventId: string
          gameStart: string
          origin: ResultReviewOrigin
          scores: number[] | null
      }
    | {
          kind: "confirmAttendance"
          eventId: string
          gameStart: string
          unconfirmed: number
      }

const QUEUE_ORDER: Record<MatchQueueItem["kind"], number> = {
    publishRoster: 0,
    confirmResult: 1,
    confirmAttendance: 2,
}

const DAY_MS = 24 * 60 * 60 * 1000

/** How long after a match its open attendance stays in the queue. */
const ATTENDANCE_TASK_DAYS = 14

/** Roster players who have not confirmed they will play. */
export function unconfirmedRosterPlayers(roster: MatchListRoster) {
    return rosterCounts(roster).unconfirmed
}

/**
 * Organiser tasks, most urgent kind first: matches whose sign-ups have closed
 * but whose roster is not published (soonest first), played matches whose
 * staged result waits for confirmation, and played matches of the last two
 * weeks with a published roster whose attendance has not been closed yet
 * (both newest first). Drafts never create tasks. Each kind shows at most
 * `perKind` items so one kind cannot hide the others.
 */
export function matchListQueue(
    events: readonly MatchListEvent[],
    rosters: readonly MatchListRoster[],
    now: Date,
    reviews: ReadonlyMap<string, MatchListResultReview> = new Map(),
    { perKind = 3, limit = 6 }: { perKind?: number; limit?: number } = {}
): MatchQueueItem[] {
    const rosterByEvent = new Map(
        rosters.map((roster) => [roster.eventId, roster])
    )
    const items: MatchQueueItem[] = []
    for (const event of events) {
        if (event.kind !== "match" || event.isDraft) continue
        const review = reviews.get(event.id)
        const phase = matchListPhase(
            event,
            rosterByEvent.get(event.id),
            now,
            review
        )
        if (phase.kind === "rosterMissing" || phase.kind === "rosterDraft")
            items.push({
                kind: "publishRoster",
                eventId: event.id,
                gameStart: event.gameStart,
                signedUp: attendingCount(event),
                openSlots:
                    phase.kind === "rosterDraft" ? phase.openSlots : undefined,
            })
        else if (phase.kind === "resultPending" && review)
            items.push({
                kind: "confirmResult",
                eventId: event.id,
                gameStart: event.gameStart,
                origin: review.origin,
                scores: phase.scores,
            })
        const roster = rosterByEvent.get(event.id)
        const endedAgo = now.getTime() - Date.parse(event.gameEnd)
        if (
            roster?.published &&
            isPlayed(event, now) &&
            !event.scoreResolution &&
            !event.scoreAppliedAt &&
            endedAgo <= ATTENDANCE_TASK_DAYS * DAY_MS
        )
            items.push({
                kind: "confirmAttendance",
                eventId: event.id,
                gameStart: event.gameStart,
                unconfirmed: unconfirmedRosterPlayers(roster),
            })
    }
    const counts = new Map<MatchQueueItem["kind"], number>()
    return items
        .sort((left, right) => {
            const byKind = QUEUE_ORDER[left.kind] - QUEUE_ORDER[right.kind]
            if (byKind) return byKind
            const byTime =
                Date.parse(left.gameStart) - Date.parse(right.gameStart)
            // Played matches are worked newest first; upcoming ones soonest first.
            return left.kind === "publishRoster" ? byTime : -byTime
        })
        .filter((item) => {
            const count = counts.get(item.kind) ?? 0
            counts.set(item.kind, count + 1)
            return count < perKind
        })
        .slice(0, limit)
}

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
