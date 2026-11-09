import { MAX_SIGNUP_GROUP_LIMIT } from "./signup-limits"

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

/** An invited clan owns its opening time; the host still owns the deadline. */
export function sharedRegistrationStart(
    value: string | undefined,
    registrationEnd: string
) {
    if (value === undefined) return undefined
    const start = Date.parse(value)
    const end = Date.parse(registrationEnd)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end)
        throw new Error(
            "Registration must start before the host's registration deadline."
        )
    return new Date(start).toISOString()
}

export type SharedSignupGroup = { groupId: string; max?: number }

/** Host invitation ceilings cannot be widened by a guest's local settings. */
export function validateSharedSignupGroups(
    groups: readonly SharedSignupGroup[],
    allowedIds: readonly string[]
): SharedSignupGroup[] {
    const ids = new Set<string>()
    if (groups.length > 100) throw new Error("Too many signup groups.")
    for (const group of groups) {
        if (!allowedIds.includes(group.groupId) || ids.has(group.groupId))
            throw new Error(
                "Choose distinct signup groups offered by the host."
            )
        if (
            group.max !== undefined &&
            (!Number.isInteger(group.max) ||
                group.max < 1 ||
                group.max > MAX_SIGNUP_GROUP_LIMIT)
        )
            throw new Error(
                `Group limits must be whole numbers between 1 and ${MAX_SIGNUP_GROUP_LIMIT}.`
            )
        ids.add(group.groupId)
    }
    return groups.map((group) => ({ ...group }))
}

export function sharedSignupLimits(
    groups: readonly SharedSignupGroup[],
    selectedIds: readonly string[],
    limits: readonly { groupId: string; max: number }[]
) {
    validateSharedSignupGroups(
        selectedIds.map((groupId) => ({ groupId })),
        groups.map((group) => group.groupId)
    )
    const selected = new Set(selectedIds)
    if (
        limits.some((limit) => !selected.has(limit.groupId)) ||
        new Set(limits.map((limit) => limit.groupId)).size !== limits.length
    )
        throw new Error("Limits must refer to distinct selected signup groups.")
    validateSharedSignupGroups(limits, selectedIds)
    return selectedIds.flatMap((groupId) => {
        const ceiling = groups.find((group) => group.groupId === groupId)?.max
        const local = limits.find((limit) => limit.groupId === groupId)?.max
        if (ceiling !== undefined && local !== undefined && local > ceiling)
            throw new Error("Signup limit exceeds the host's invitation limit.")
        const max = local ?? ceiling
        return max === undefined ? [] : [{ groupId, max }]
    })
}

/** Custom Discord emoji are guild resources; foreign groups use their colour. */
export function sharedGroupPresentation<
    T extends { discordEmoji?: string; discordRoleId?: string },
>(group: T): T {
    return {
        ...group,
        discordRoleId: undefined,
        discordEmoji:
            group.discordEmoji &&
            /^<a?:[a-zA-Z0-9_]+:\d+>$/.test(group.discordEmoji.trim())
                ? undefined
                : group.discordEmoji,
    }
}
