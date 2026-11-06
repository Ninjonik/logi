/** Match facts have one owner; Discord configuration and signups stay local. */
export const SHARED_MATCH_FIELDS = [
    "gameId",
    "kind",
    "name",
    "description",
    "thumbnailUrl",
    "imageUrl",
    "matchType",
    "durationMinutes",
    "server",
    "serverPassword",
    "side",
    "map",
    "timeOfDay",
    "tacticalPlan",
    "cap",
    "notes",
    "registrationStart",
    "registrationEnd",
    "meetingStart",
    "gameStart",
    "gameEnd",
    "status",
    "statusUpdatedAt",
    "concludedAt",
    "eventResult",
    "reviewedResult",
    "reviewedResultGameId",
    "matchStatsId",
    "wardogsReportId",
    "matchTeams",
    "allowLateSignups",
    "stratmapIds",
] as const

export type RequestedMatchRole = { role: string; count: number }

export function validateRequestedRoles(roles: RequestedMatchRole[]) {
    if (
        roles.length > 32 ||
        roles.some(
            (item) =>
                !item.role.trim() ||
                item.role.length > 100 ||
                !Number.isInteger(item.count) ||
                item.count < 1 ||
                item.count > 500
        )
    )
        throw new Error("Invalid requested roles.")
    return roles.map((item) => ({ role: item.role.trim(), count: item.count }))
}

/** Main-clan membership takes priority; otherwise keep the selected local representation. */
export function participantClan(input: {
    mainGuildId?: string
    participatingGuildIds: readonly string[]
    selectedGuildId: string
}) {
    if (!input.participatingGuildIds.includes(input.selectedGuildId))
        throw new Error("Clan is not participating in this match.")
    return input.mainGuildId &&
        input.participatingGuildIds.includes(input.mainGuildId)
        ? input.mainGuildId
        : input.selectedGuildId
}
