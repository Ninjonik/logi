import type { EventNotice, EventStatus } from "@/domain/events/types"
import { normalizeOptionalArray } from "@/domain/shared/collections"

import { setRosterAttendanceStatus } from "./attendance-policy"
import type { RosterLike } from "./types"

export const DECLINE_REASON_MAX_LENGTH = 500

export type AttendanceDeclineError =
    "roster_not_published" | "too_late" | "not_on_roster" | "invalid_reason"

export class AttendanceDeclineRejected extends Error {
    constructor(readonly code: AttendanceDeclineError) {
        super(code)
    }
}

export type RosterPlacement =
    { kind: "slot"; squadName: string; roleName?: string } | { kind: "reserve" }

/** Where a player stands on the roster, or null when they are not on it. */
export function findRosterPlacement(
    roster: RosterLike,
    userId: string
): RosterPlacement | null {
    for (const squad of roster.squads) {
        const player = squad.players.find((item) => item.id === userId)
        if (player)
            return {
                kind: "slot",
                squadName: squad.name,
                ...(player.roleName?.trim()
                    ? { roleName: player.roleName.trim() }
                    : {}),
            }
    }
    return roster.reservePlayerIds.includes(userId) ? { kind: "reserve" } : null
}

/**
 * A player on the published roster says they cannot come. The decision is an
 * absence notice (the attendance page then counts them as excused and the
 * roster board shows the reason), and their attendance confirmation is
 * withdrawn. The slot stays: the organisers decide who replaces them.
 *
 * Declining again with the same reason changes nothing (`changed: false`):
 * callers then write nothing, so a repeated button press neither rewrites
 * data nor informs the organisers twice.
 */
export function declineRosterAttendance<T extends RosterLike>(input: {
    roster: T
    event: {
        gameStart: string
        status: EventStatus
        absenceNotices?: EventNotice[]
    }
    userId: string
    reason: string
    now: Date
}): {
    roster: T
    absenceNotices: EventNotice[]
    placement: RosterPlacement
    changed: boolean
} {
    const reason = input.reason.trim()
    if (!reason || reason.length > DECLINE_REASON_MAX_LENGTH)
        throw new AttendanceDeclineRejected("invalid_reason")
    if (!input.roster.published)
        throw new AttendanceDeclineRejected("roster_not_published")
    const gameStart = Date.parse(input.event.gameStart)
    if (
        input.event.status === "concluded" ||
        !Number.isFinite(gameStart) ||
        input.now.getTime() >= gameStart
    )
        throw new AttendanceDeclineRejected("too_late")
    const placement = findRosterPlacement(input.roster, input.userId)
    if (placement === null) throw new AttendanceDeclineRejected("not_on_roster")

    const notices = normalizeOptionalArray(input.event.absenceNotices)
    const previous = notices.find((notice) => notice.userId === input.userId)
    const roster = setRosterAttendanceStatus(
        input.roster,
        input.userId,
        "pending"
    )
    // A late notice with the same words is still replaced: the player now
    // cannot come at all.
    const sameNotice =
        previous?.reason === reason && previous.kind === "cannot_come"
    const changed = !sameNotice || isAcknowledged(input.roster, input.userId)
    return {
        roster,
        absenceNotices: sameNotice
            ? notices
            : [
                  ...notices.filter((notice) => notice.userId !== input.userId),
                  {
                      userId: input.userId,
                      reason,
                      createdAt: input.now.toISOString(),
                      kind: "cannot_come" as const,
                  },
              ],
        placement,
        changed,
    }
}

function isAcknowledged(roster: RosterLike, userId: string) {
    for (const squad of roster.squads)
        for (const player of squad.players)
            if (player.id === userId) return player.ack || !!player.confirmed
    const reserve = normalizeOptionalArray(roster.reserveAttendances).find(
        (entry) => entry.userId === userId
    )
    return Boolean(reserve && (reserve.ack || reserve.confirmed))
}
