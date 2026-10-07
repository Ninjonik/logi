import { deriveEventStatus } from "./status"
import type { EventStatus } from "./types"

/** The five steps of a match as the match detail shows them. */
export const MATCH_PHASES = [
    "draft",
    "signups",
    "roster",
    "match",
    "result",
] as const

export type MatchPhaseId = (typeof MATCH_PHASES)[number]
export type MatchPhaseState = "done" | "current" | "upcoming"
export type MatchResultState =
    "none" | "imported" | "provisional" | "confirmed" | "corrected"

/** What a step says under its name; the page formats dates and numbers. */
export type MatchPhaseDetail =
    | { kind: "createdAt"; at: string }
    | { kind: "opensAt"; at: string }
    | { kind: "closesAt"; at: string }
    | { kind: "closedAt"; at: string }
    | { kind: "signedUp"; count: number }
    | { kind: "rosterMissing" }
    | { kind: "rosterDraft" }
    | { kind: "rosterPublished"; count: number }
    | { kind: "meetingAt"; at: string }
    | { kind: "present"; count: number }
    | { kind: "result"; state: MatchResultState }

export type MatchPhaseStep = {
    id: MatchPhaseId
    state: MatchPhaseState
    detail: MatchPhaseDetail
}

export type MatchPhaseInput = {
    createdAt: string
    registrationStart?: string
    registrationEnd: string
    meetingStart: string
    gameEnd: string
    status?: EventStatus
    /** Players signed up as attending. */
    signedUpCount: number
    roster: { published: boolean; assignedCount: number } | null
    /** Roster players and reserves confirmed as present. */
    presentCount: number
    result: MatchResultState
}

function reached(at: string | undefined, now: Date) {
    const time = at ? new Date(at).getTime() : Number.NaN
    return Number.isFinite(time) && now.getTime() >= time
}

/**
 * Where a match stands: steps before the current one are done, the rest are
 * upcoming. A closed match with a confirmed or corrected result has every step
 * done. The status follows the schedule like the rest of the app, so a match
 * past its end reads as closed before the bot records it.
 */
export function deriveMatchPhases(
    input: MatchPhaseInput,
    now: Date
): MatchPhaseStep[] {
    const status = deriveEventStatus(
        {
            status: input.status,
            registrationEnd: input.registrationEnd,
            meetingStart: input.meetingStart,
            gameEnd: input.gameEnd,
        },
        now
    )
    const registrationOpen =
        !input.registrationStart || reached(input.registrationStart, now)
    const registrationClosed = reached(input.registrationEnd, now)
    const meetingReached = reached(input.meetingStart, now)
    const resultReviewed =
        input.result === "confirmed" || input.result === "corrected"

    const current: MatchPhaseId | null =
        status === "concluded"
            ? resultReviewed
                ? null
                : "result"
            : meetingReached || (registrationClosed && input.roster?.published)
              ? "match"
              : registrationClosed
                ? "roster"
                : registrationOpen
                  ? "signups"
                  : "draft"
    const currentIndex =
        current === null ? MATCH_PHASES.length : MATCH_PHASES.indexOf(current)

    const details: Record<MatchPhaseId, MatchPhaseDetail> = {
        draft:
            !registrationOpen && input.registrationStart
                ? { kind: "opensAt", at: input.registrationStart }
                : { kind: "createdAt", at: input.createdAt },
        // While the roster is built the step says when sign-ups closed
        // (design D3); from the match on it counts them (E2).
        signups:
            currentIndex > MATCH_PHASES.indexOf("roster")
                ? { kind: "signedUp", count: input.signedUpCount }
                : registrationClosed
                  ? { kind: "closedAt", at: input.registrationEnd }
                  : { kind: "closesAt", at: input.registrationEnd },
        roster: !input.roster
            ? { kind: "rosterMissing" }
            : input.roster.published
              ? { kind: "rosterPublished", count: input.roster.assignedCount }
              : { kind: "rosterDraft" },
        match:
            status === "concluded"
                ? { kind: "present", count: input.presentCount }
                : { kind: "meetingAt", at: input.meetingStart },
        result: { kind: "result", state: input.result },
    }

    return MATCH_PHASES.map((id, index) => ({
        id,
        state:
            index < currentIndex
                ? "done"
                : index === currentIndex
                  ? "current"
                  : "upcoming",
        detail: details[id],
    }))
}
