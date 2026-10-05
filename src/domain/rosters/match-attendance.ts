import { setRosterAttendanceStatus } from "./attendance-policy"
import type { RosterLike } from "./types"

/** Attendance of one player as an admin records it after the match. */
export type AttendanceMark = "present" | "excused" | "absent"

/** What the player told the clan before the match. */
export type AttendanceBefore =
    | { kind: "notice"; reason: string }
    | { kind: "reserve" }
    | { kind: "acknowledged" }
    | { kind: "pending" }

export type MatchAttendanceEntry = {
    userId: string
    placement:
        | { kind: "slot"; squadName: string; roleName?: string }
        | { kind: "reserve" }
    before: AttendanceBefore
    mark: AttendanceMark
    /** Excused needs an absence notice, which only the player can send. */
    hasNotice: boolean
}

export type MatchAttendance = {
    entries: MatchAttendanceEntry[]
    declinedUserIds: string[]
    noResponseUserIds: string[]
    counts: {
        roster: Record<AttendanceMark, number> & { total: number }
        reserves: Record<AttendanceMark, number> & { total: number }
        declined: number
        noResponse: number
    }
}

function emptyCounts() {
    return { present: 0, excused: 0, absent: 0, total: 0 }
}

/**
 * The attendance list of a match: roster players in squad order, then the
 * reserves, each with the mark that decides their points (present when
 * confirmed, excused with an absence notice, absent otherwise), plus the
 * members who declined and the scored members who never answered.
 */
export function buildMatchAttendance(input: {
    roster: Pick<
        RosterLike,
        "squads" | "reservePlayerIds" | "reserveAttendances"
    > | null
    participants: Array<{
        userId: string
        status: "attending" | "not_attending"
    }>
    notices: Array<{ userId: string; reason: string }>
    /** Members whose points change when the match closes. */
    memberIds: readonly string[]
}): MatchAttendance {
    const noticeByUserId = new Map(
        input.notices.map((notice) => [notice.userId, notice.reason])
    )
    const entries: MatchAttendanceEntry[] = []
    const seen = new Set<string>()
    const counts = {
        roster: emptyCounts(),
        reserves: emptyCounts(),
        declined: 0,
        noResponse: 0,
    }

    function markFor(userId: string, confirmed: boolean | undefined) {
        return confirmed
            ? "present"
            : noticeByUserId.has(userId)
              ? "excused"
              : "absent"
    }

    const squads = [...(input.roster?.squads ?? [])].sort(
        (left, right) => left.order - right.order
    )
    for (const squad of squads) {
        for (const player of squad.players) {
            if (!player.id || seen.has(player.id)) continue
            seen.add(player.id)
            const reason = noticeByUserId.get(player.id)
            const mark = markFor(player.id, player.confirmed)
            counts.roster[mark] += 1
            counts.roster.total += 1
            entries.push({
                userId: player.id,
                placement: {
                    kind: "slot",
                    squadName: squad.name,
                    roleName: player.roleName,
                },
                before:
                    reason !== undefined
                        ? { kind: "notice", reason }
                        : player.ack
                          ? { kind: "acknowledged" }
                          : { kind: "pending" },
                mark,
                hasNotice: reason !== undefined,
            })
        }
    }

    const reserveAttendance = new Map(
        (input.roster?.reserveAttendances ?? []).map((attendance) => [
            attendance.userId,
            attendance,
        ])
    )
    for (const userId of input.roster?.reservePlayerIds ?? []) {
        if (seen.has(userId)) continue
        seen.add(userId)
        const reason = noticeByUserId.get(userId)
        const mark = markFor(userId, reserveAttendance.get(userId)?.confirmed)
        counts.reserves[mark] += 1
        counts.reserves.total += 1
        entries.push({
            userId,
            placement: { kind: "reserve" },
            before:
                reason !== undefined
                    ? { kind: "notice", reason }
                    : { kind: "reserve" },
            mark,
            hasNotice: reason !== undefined,
        })
    }

    const declinedUserIds = input.participants
        .filter(
            (participant) =>
                participant.status === "not_attending" &&
                !seen.has(participant.userId)
        )
        .map((participant) => participant.userId)
    const answered = new Set([
        ...seen,
        ...input.participants.map((participant) => participant.userId),
    ])
    const noResponseUserIds = [...new Set(input.memberIds)].filter(
        (userId) => !answered.has(userId)
    )
    counts.declined = declinedUserIds.length
    counts.noResponse = noResponseUserIds.length

    return { entries, declinedUserIds, noResponseUserIds, counts }
}

/**
 * Records whether a roster player or reserve came. Absence keeps an earlier
 * acknowledgement, so the player's own answer is not lost.
 */
export function setRosterPresence<T extends RosterLike>(
    roster: T,
    userId: string,
    present: boolean
): T {
    const acknowledged =
        roster.squads.some((squad) =>
            squad.players.some((player) => player.id === userId && player.ack)
        ) ||
        (roster.reserveAttendances ?? []).some(
            (attendance) => attendance.userId === userId && attendance.ack
        )
    return setRosterAttendanceStatus(
        roster,
        userId,
        present ? "confirmed" : acknowledged ? "acknowledged" : "pending"
    )
}
