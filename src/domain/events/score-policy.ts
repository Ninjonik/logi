export type RosterScoreSettings = {
    noCategory: number
    declined: number
    rosterPresent: number
    reservePresent: number
    rosterAbsent: number
    reserveAbsent: number
    excusedAbsence: number
}

export type ScorableParticipant = {
    userId: string
    status: "attending" | "not_attending"
}

export type ScorableNotice = {
    userId: string
}

export type ScorableRoster = {
    squads: Array<{
        players: Array<{
            id?: string
            confirmed?: boolean
        }>
    }>
    reservePlayerIds: string[]
    reserveAttendances?: Array<{
        userId: string
        confirmed?: boolean
    }>
}

function buildRosterLookup(roster: ScorableRoster | null) {
    const rosteredUserIds = new Set<string>()
    const confirmedRosteredUserIds = new Set<string>()
    const reserveUserIds = new Set<string>(roster?.reservePlayerIds ?? [])
    const confirmedReserveUserIds = new Set<string>()

    for (const squad of roster?.squads ?? []) {
        for (const player of squad.players) {
            if (!player.id) continue
            rosteredUserIds.add(player.id)
            if (player.confirmed) {
                confirmedRosteredUserIds.add(player.id)
            }
        }
    }

    for (const attendance of roster?.reserveAttendances ?? []) {
        if (attendance.confirmed) {
            confirmedReserveUserIds.add(attendance.userId)
        }
    }

    return {
        rosteredUserIds,
        confirmedRosteredUserIds,
        reserveUserIds,
        confirmedReserveUserIds,
    }
}

/** Points when a clan has not set its own rules; the same values as
 * `DEFAULT_ROSTER_SCORE_SETTINGS` in `convex/guilds.ts`, which closing a
 * match applies. */
export const DEFAULT_ROSTER_SCORE_SETTINGS: RosterScoreSettings = {
    noCategory: 0,
    declined: -1,
    rosterPresent: 0,
    reservePresent: 0,
    rosterAbsent: 0,
    reserveAbsent: 0,
    excusedAbsence: 0,
}

/** The attendance rule a member falls under when a match closes. */
export type RosterScoreCategory = keyof RosterScoreSettings

/** Display and summary order of the categories. */
export const ROSTER_SCORE_CATEGORIES = [
    "rosterPresent",
    "reservePresent",
    "excusedAbsence",
    "rosterAbsent",
    "reserveAbsent",
    "declined",
    "noCategory",
] as const satisfies readonly RosterScoreCategory[]

type ScoreLookup = {
    participantByUserId: Map<string, ScorableParticipant>
    noticeUserIds: Set<string>
    roster: ReturnType<typeof buildRosterLookup>
}

function buildScoreLookup(input: {
    participants: ScorableParticipant[]
    notices: ScorableNotice[]
    roster: ScorableRoster | null
}): ScoreLookup {
    return {
        participantByUserId: new Map(
            input.participants.map((participant) => [
                participant.userId,
                participant,
            ])
        ),
        noticeUserIds: new Set(input.notices.map((notice) => notice.userId)),
        roster: buildRosterLookup(input.roster),
    }
}

function categoryFor(userId: string, lookup: ScoreLookup): RosterScoreCategory {
    const participant = lookup.participantByUserId.get(userId)
    const rosterLookup = lookup.roster

    if (participant?.status === "not_attending") {
        return "declined"
    }

    if (
        participant?.status !== "attending" &&
        !rosterLookup.reserveUserIds.has(userId)
    ) {
        return "noCategory"
    }

    const isRostered = rosterLookup.rosteredUserIds.has(userId)

    if (rosterLookup.confirmedRosteredUserIds.has(userId)) {
        return "rosterPresent"
    }
    if (rosterLookup.confirmedReserveUserIds.has(userId)) {
        return "reservePresent"
    }
    if (lookup.noticeUserIds.has(userId)) {
        return "excusedAbsence"
    }
    // Everyone else who signed up is a reserve, listed or not.
    return isRostered ? "rosterAbsent" : "reserveAbsent"
}

export function resolveRosterScoreCategory(input: {
    userId: string
    participants: ScorableParticipant[]
    notices: ScorableNotice[]
    roster: ScorableRoster | null
}): RosterScoreCategory {
    return categoryFor(input.userId, buildScoreLookup(input))
}

export function resolveRosterScoreDelta(input: {
    userId: string
    settings: RosterScoreSettings
    participants: ScorableParticipant[]
    notices: ScorableNotice[]
    roster: ScorableRoster | null
}) {
    return input.settings[resolveRosterScoreCategory(input)]
}

export type RosterScoreChangeSummary = {
    /** One row per category with members, in `ROSTER_SCORE_CATEGORIES` order. */
    rows: Array<{
        category: RosterScoreCategory
        count: number
        delta: number
    }>
    /** Members whose score changes, that is, with a non-zero delta. */
    changedCount: number
}

/**
 * What closing a match does to the members' scores: the members per rule and
 * the points each rule adds. `userIds` are the members that are scored, the
 * clan's active (not paused) members, as when the match closes.
 */
export function summarizeRosterScoreChanges(input: {
    userIds: readonly string[]
    settings: RosterScoreSettings
    participants: ScorableParticipant[]
    notices: ScorableNotice[]
    roster: ScorableRoster | null
}): RosterScoreChangeSummary {
    const lookup = buildScoreLookup(input)
    const counts = new Map<RosterScoreCategory, number>()
    for (const userId of new Set(input.userIds)) {
        const category = categoryFor(userId, lookup)
        counts.set(category, (counts.get(category) ?? 0) + 1)
    }

    const rows = ROSTER_SCORE_CATEGORIES.flatMap((category) => {
        const count = counts.get(category) ?? 0
        return count > 0
            ? [{ category, count, delta: input.settings[category] }]
            : []
    })
    return {
        rows,
        changedCount: rows.reduce(
            (sum, row) => sum + (row.delta !== 0 ? row.count : 0),
            0
        ),
    }
}
