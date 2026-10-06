/**
 * Who may close a ticket or a membership application thread (`/close_ticket`,
 * `/close_application`): a Discord administrator, a Logi admin (the clan's
 * dashboard admin role) or a support role of the thread's category. Both
 * commands use this one rule with roles read fresh at use time (M3-04).
 */
export type ThreadCloseAuthorityInput = {
    /** The member has Discord's Administrator permission. */
    isAdministrator: boolean
    /** The member's current role IDs. */
    memberRoleIds: readonly string[]
    /** The clan's Logi admin role, if set. */
    dashboardAdminRoleId?: string | null
    /** Support roles of the ticket or application category. */
    supportRoleIds: readonly string[]
}

export function canCloseSupportThread(
    input: ThreadCloseAuthorityInput
): boolean {
    if (input.isAdministrator) return true
    const roles = new Set(input.memberRoleIds)
    if (input.dashboardAdminRoleId && roles.has(input.dashboardAdminRoleId))
        return true
    return input.supportRoleIds.some((roleId) => roles.has(roleId))
}
