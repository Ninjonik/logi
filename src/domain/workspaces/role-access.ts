/**
 * Who holds a Discord role and who can manage Logi (design G2), from the
 * member access the bot stores for every member of the clan's Discord server.
 */

export type StoredMemberAccess = {
    userId: string
    roleIds: readonly string[]
    isAdmin: boolean
    hasDashboardAccess: boolean
}

/** Why someone can manage Logi; a person can have several reasons. */
export type ManagerReason = "administrator" | "role" | "granted"

export type DashboardManager = {
    userId: string
    reasons: ManagerReason[]
}

/** How many members hold each role, most held first. */
export function roleMemberCounts(rows: readonly StoredMemberAccess[]) {
    const counts = new Map<string, number>()
    for (const row of rows)
        for (const roleId of new Set(row.roleIds))
            counts.set(roleId, (counts.get(roleId) ?? 0) + 1)
    return [...counts]
        .map(([roleId, count]) => ({ roleId, count }))
        .sort((a, b) => b.count - a.count || a.roleId.localeCompare(b.roleId))
}

/**
 * People who can manage Logi now, with the same decision as the dashboard's
 * access check (`canAdminServerContext`): Discord's Administrator permission
 * always counts; otherwise a manual setting in Logi decides, else being a
 * server admin in Logi or holding the manager role. Administrators first,
 * then by user ID.
 */
export function dashboardManagers(input: {
    rows: readonly StoredMemberAccess[]
    serverAdminIds: readonly string[]
    adminAccessOverrides?: Readonly<Record<string, boolean>>
    managerRoleId?: string
}): DashboardManager[] {
    const overrides = input.adminAccessOverrides ?? {}
    const rowByUser = new Map(input.rows.map((row) => [row.userId, row]))
    const candidates = new Set<string>([
        ...input.rows
            .filter((row) => row.isAdmin || row.hasDashboardAccess)
            .map((row) => row.userId),
        ...input.serverAdminIds,
        ...Object.keys(overrides).filter((userId) => overrides[userId]),
    ])
    const managers: DashboardManager[] = []
    for (const userId of candidates) {
        const row = rowByUser.get(userId)
        // The bot gives dashboard access to administrators and to holders of
        // the manager role, so for others it means the role.
        const viaRole = row
            ? row.isAdmin
                ? Boolean(
                      input.managerRoleId &&
                      row.roleIds.includes(input.managerRoleId)
                  )
                : row.hasDashboardAccess
            : false
        const allowedInLogi =
            overrides[userId] ??
            (input.serverAdminIds.includes(userId) || viaRole)
        const reasons: ManagerReason[] = []
        if (row?.isAdmin) reasons.push("administrator")
        if (allowedInLogi) reasons.push(viaRole ? "role" : "granted")
        if (reasons.length) managers.push({ userId, reasons })
    }
    return managers.sort(
        (a, b) =>
            Number(b.reasons.includes("administrator")) -
                Number(a.reasons.includes("administrator")) ||
            a.userId.localeCompare(b.userId)
    )
}
