/** Missing on ordinary rosters, where every rostered player is local. */
export function isLocalRosterPlayer(
    roster: { localPlayerIds?: readonly string[] },
    userId: string
) {
    return (
        roster.localPlayerIds === undefined ||
        roster.localPlayerIds.includes(userId)
    )
}

export function canReadSharedRosterPassword(input: {
    hostAdmin: boolean
    userId: string
    roster: {
        published: boolean
        localPlayerIds?: readonly string[]
        reservePlayerIds: readonly string[]
        squads: readonly { players: readonly { id?: string }[] }[]
    } | null
}) {
    if (input.hostAdmin) return true
    const { roster, userId } = input
    return Boolean(
        roster?.published &&
        isLocalRosterPlayer(roster, userId) &&
        (roster.reservePlayerIds.includes(userId) ||
            roster.squads.some((squad) =>
                squad.players.some((slot) => slot.id === userId)
            ))
    )
}

export function localRosterLists<
    T extends {
        localPlayerIds?: readonly string[]
        reservePlayerIds: string[]
        notAttendingPlayerIds?: string[]
        reserveAttendances?: { userId: string }[]
    },
>(roster: T): T {
    if (roster.localPlayerIds === undefined) return roster
    return {
        ...roster,
        reservePlayerIds: roster.reservePlayerIds.filter((id) =>
            isLocalRosterPlayer(roster, id)
        ),
        notAttendingPlayerIds: roster.notAttendingPlayerIds?.filter((id) =>
            isLocalRosterPlayer(roster, id)
        ),
        reserveAttendances: roster.reserveAttendances?.filter((item) =>
            isLocalRosterPlayer(roster, item.userId)
        ),
    }
}
