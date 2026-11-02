import { setRosterPresence } from "./match-attendance"
import type { RosterLike } from "./types"

export function attendanceName(value: string): string {
    return value
        .normalize("NFKD")
        .replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|<[^>]*>/g, "")
        .toLowerCase()
        .replace(/\p{M}/gu, "")
        .replace(/[^\p{L}\p{N}]/gu, "")
}

export type AttendanceIdentity = {
    userId: string
    logiUserId: string
    names: readonly string[]
}
export type AttendanceEvidence = {
    key: string
    logiUserId: string | null
    name?: string | null
}

/** Only add presence; ambiguous names and existing confirmations are untouched. */
export function reconcileResultAttendance<T extends RosterLike>(
    roster: T,
    identities: AttendanceIdentity[],
    evidence: AttendanceEvidence[]
): T {
    const owners = new Map<string, Set<string>>()
    for (const identity of identities)
        for (const name of identity.names) {
            const normalized = attendanceName(name)
            if (!normalized) continue
            const ids = owners.get(normalized) ?? new Set<string>()
            ids.add(identity.userId)
            owners.set(normalized, ids)
        }
    const matching = new Map<string, Set<string>>()
    for (const player of evidence) {
        const name = attendanceName(player.name ?? "")
        const keys = matching.get(name) ?? new Set<string>()
        keys.add(player.key)
        matching.set(name, keys)
    }
    let next = roster
    for (const identity of identities) {
        const present =
            roster.squads.some((s) =>
                s.players.some((p) => p.id === identity.userId && p.confirmed)
            ) ||
            roster.reserveAttendances?.some(
                (p) => p.userId === identity.userId && p.confirmed
            )
        if (present) continue
        const found = evidence.some((player) =>
            player.logiUserId !== null
                ? player.logiUserId === identity.logiUserId
                : identity.names.some((name) => {
                      const normalized = attendanceName(name)
                      return (
                          normalized !== "" &&
                          normalized === attendanceName(player.name ?? "") &&
                          owners.get(normalized)?.size === 1 &&
                          matching.get(normalized)?.size === 1
                      )
                  })
        )
        if (found) next = setRosterPresence(next, identity.userId, true)
    }
    return next
}
