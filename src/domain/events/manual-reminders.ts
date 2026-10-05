import type {
    EventKind,
    EventStatus,
    ParticipantStatus,
    SignupMembershipStatus,
} from "./types"
import { DEFAULT_ALLOWED_SIGNUP_STATUSES } from "./signup-policy"
import { getResolvedMemberStatus } from "../assignments/policy"
import { matchesGameScope, type GameId } from "../games/game"
import { canAcceptSignups } from "./status"

/**
 * Who a manual reminder goes to: members who have not answered the sign-up,
 * or roster players and reserves who have not confirmed their place.
 */
export const MANUAL_REMINDER_AUDIENCES = ["unanswered", "unconfirmed"] as const
export type ManualReminderAudience = (typeof MANUAL_REMINDER_AUDIENCES)[number]

/** One manual reminder per match and audience in this window. */
export const MANUAL_REMINDER_COOLDOWN_MS = 30 * 60 * 1000
/** A queued reminder the bot has not picked up in this time no longer blocks a new one. */
export const MANUAL_REMINDER_STALE_MS = 10 * 60 * 1000

export type ManualReminderEvent = {
    kind?: EventKind
    gameId?: GameId
    status?: EventStatus
    isDraft?: boolean
    registrationEnd: string
    meetingStart: string
    allowedSignupStatuses?: SignupMembershipStatus[]
    participants: Array<{ userId: string; status: ParticipantStatus }>
}

export type ManualReminderRoster = {
    published: boolean
    squads: Array<{ players: Array<{ id?: string; ack?: boolean }> }>
    reservePlayerIds: string[]
    reserveAttendances?: Array<{ userId: string; ack?: boolean }>
    notAttendingPlayerIds?: string[]
}

export type ManualReminderAssignment = {
    userId: string
    gameId?: GameId
    type: "member" | "reserve_member" | "mercenary"
    status: "pending" | "recruit" | "active"
    paused?: boolean
}

export type ManualReminderUnavailable =
    | "concluded"
    | "draft"
    | "signups_closed"
    | "no_roster"
    | "roster_unpublished"
    | "meeting_started"

export type ManualReminderRecipients =
    | { ok: true; userIds: string[] }
    | { ok: false; reason: ManualReminderUnavailable }

function rosterUserIds(roster: ManualReminderRoster | null) {
    const ids = new Set<string>()
    for (const squad of roster?.squads ?? []) {
        for (const player of squad.players) {
            if (player.id) ids.add(player.id)
        }
    }
    for (const userId of roster?.reservePlayerIds ?? []) ids.add(userId)
    for (const userId of roster?.notAttendingPlayerIds ?? []) ids.add(userId)
    return ids
}

function unansweredUserIds(
    event: ManualReminderEvent,
    roster: ManualReminderRoster | null,
    assignments: readonly ManualReminderAssignment[]
) {
    const answered = new Set([
        ...event.participants.map((participant) => participant.userId),
        ...rosterUserIds(roster),
    ])
    const allowed = new Set<SignupMembershipStatus>(
        event.allowedSignupStatuses?.length
            ? event.allowedSignupStatuses
            : DEFAULT_ALLOWED_SIGNUP_STATUSES
    )
    const userIds = new Set<string>()
    for (const assignment of assignments) {
        if (assignment.paused || answered.has(assignment.userId)) continue
        if (!matchesGameScope(assignment.gameId, event.gameId)) continue
        const status = getResolvedMemberStatus(
            assignment.type,
            assignment.status
        )
        if (status === "pending" || !allowed.has(status)) continue
        userIds.add(assignment.userId)
    }
    return [...userIds]
}

function unconfirmedUserIds(roster: ManualReminderRoster | null) {
    const userIds = new Set<string>()
    for (const squad of roster?.squads ?? []) {
        for (const player of squad.players) {
            if (player.id && !player.ack) userIds.add(player.id)
        }
    }
    const acknowledgedReserves = new Set(
        (roster?.reserveAttendances ?? [])
            .filter((attendance) => attendance.ack)
            .map((attendance) => attendance.userId)
    )
    for (const userId of roster?.reservePlayerIds ?? []) {
        if (!acknowledgedReserves.has(userId)) userIds.add(userId)
    }
    return [...userIds]
}

function unavailableReason(input: {
    audience: ManualReminderAudience
    event: ManualReminderEvent
    roster: ManualReminderRoster | null
    now: Date
}): ManualReminderUnavailable | null {
    const { event } = input
    if (event.status === "concluded") return "concluded"
    if (event.isDraft) return "draft"
    if (input.audience === "unanswered") {
        return canAcceptSignups(
            {
                kind: event.kind,
                registrationEnd: event.registrationEnd,
                status: event.status,
            },
            input.now
        )
            ? null
            : "signups_closed"
    }
    if (!input.roster) return "no_roster"
    if (!input.roster.published) return "roster_unpublished"
    const meetingStart = new Date(event.meetingStart).getTime()
    return Number.isFinite(meetingStart) && input.now.getTime() < meetingStart
        ? null
        : "meeting_started"
}

/**
 * Who an audience covers and whether a reminder can go to them now, for the
 * counts next to the "Remind" buttons. Unanswered: members of the match's
 * game who may sign up, are not paused, have not answered and are not
 * already placed on the roster; reminders only while sign-ups are open.
 * Unconfirmed: roster players and reserves who have not confirmed;
 * reminders only for a published roster before the meeting.
 */
export function describeManualReminderAudience(input: {
    audience: ManualReminderAudience
    event: ManualReminderEvent
    roster: ManualReminderRoster | null
    assignments: readonly ManualReminderAssignment[]
    now: Date
}): { userIds: string[]; unavailable: ManualReminderUnavailable | null } {
    return {
        userIds:
            input.audience === "unanswered"
                ? unansweredUserIds(
                      input.event,
                      input.roster,
                      input.assignments
                  )
                : unconfirmedUserIds(input.roster),
        unavailable: unavailableReason(input),
    }
}

/** The players a manual reminder reaches right now, or why it cannot be sent. */
export function resolveManualReminderRecipients(input: {
    audience: ManualReminderAudience
    event: ManualReminderEvent
    roster: ManualReminderRoster | null
    assignments: readonly ManualReminderAssignment[]
    now: Date
}): ManualReminderRecipients {
    const { userIds, unavailable } = describeManualReminderAudience(input)
    return unavailable
        ? { ok: false, reason: unavailable }
        : { ok: true, userIds }
}

export type ManualReminderRequestState = {
    audience: ManualReminderAudience
    requestedAt: string
    status: "pending" | "processing" | "sent" | "failed"
    recipientCount: number
}

export type ManualReminderDecision =
    | { kind: "queue" }
    | { kind: "already_queued"; recipientCount: number }
    | { kind: "rate_limited"; retryAt: string }

/**
 * Whether a new manual reminder may be queued. A reminder still waiting for
 * the bot answers a repeated click with the same count instead of queuing a
 * second one; a reminder sent recently blocks another to the same audience
 * of the same match until the cool-down ends. Failed ones never block.
 */
export function decideManualReminder(input: {
    audience: ManualReminderAudience
    previous: readonly ManualReminderRequestState[]
    now: Date
}): ManualReminderDecision {
    const now = input.now.getTime()
    const sameAudience = input.previous
        .filter(
            (request) =>
                request.audience === input.audience &&
                request.status !== "failed"
        )
        .map((request) => ({
            ...request,
            at: new Date(request.requestedAt).getTime(),
        }))
        .filter((request) => Number.isFinite(request.at))
        .sort((left, right) => right.at - left.at)

    const waiting = sameAudience.find(
        (request) =>
            (request.status === "pending" || request.status === "processing") &&
            now - request.at < MANUAL_REMINDER_STALE_MS
    )
    if (waiting) {
        return {
            kind: "already_queued",
            recipientCount: waiting.recipientCount,
        }
    }

    const latest = sameAudience.find((request) => request.status === "sent")
    if (latest && now - latest.at < MANUAL_REMINDER_COOLDOWN_MS) {
        return {
            kind: "rate_limited",
            retryAt: new Date(
                latest.at + MANUAL_REMINDER_COOLDOWN_MS
            ).toISOString(),
        }
    }
    return { kind: "queue" }
}

/**
 * Recipients that still need the reminder when the bot sends it: whoever
 * answered or confirmed in the meantime is skipped.
 */
export function remainingManualReminderRecipients(input: {
    requested: readonly string[]
    current: ManualReminderRecipients
}): string[] {
    if (!input.current.ok) return []
    const still = new Set(input.current.userIds)
    return input.requested.filter((userId) => still.has(userId))
}
