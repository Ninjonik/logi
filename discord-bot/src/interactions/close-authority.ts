import { PermissionFlagsBits } from "discord.js"

import { canCloseSupportThread } from "../../../src/domain/membership/thread-close-authority"

/** The parts of a guild the check reads; a discord.js `Guild` fits. */
export type CloseAuthorityGuild = {
    fetch(): Promise<{
        roles: { fetch(): Promise<unknown> }
        members: {
            fetch(options: { user: string; force: true }): Promise<{
                permissions: { has(permission: bigint): boolean }
                roles: { cache: { keys(): Iterable<string> } }
            }>
        }
    }>
}

export type CloseAuthority = "allowed" | "denied" | "unverifiable"

/**
 * The one check of `/close_ticket` and `/close_application` (M3-04): the
 * guild, its role definitions and the member are read fresh at use time,
 * then the shared rule decides. Any failure to read them is "unverifiable",
 * so a thread is never closed on stale authority.
 */
export async function checkCloseAuthority(
    guild: CloseAuthorityGuild | null | undefined,
    userId: string,
    policy: {
        dashboardAdminRoleId?: string | null
        supportRoleIds?: readonly string[] | null
    }
): Promise<CloseAuthority> {
    if (!guild) return "unverifiable"
    try {
        // Permissions also depend on guild ownership and role definitions,
        // not only on the member's assigned role IDs.
        const fresh = await guild.fetch()
        await fresh.roles.fetch()
        const member = await fresh.members.fetch({ user: userId, force: true })
        return canCloseSupportThread({
            isAdministrator: member.permissions.has(
                PermissionFlagsBits.Administrator
            ),
            memberRoleIds: [...member.roles.cache.keys()],
            dashboardAdminRoleId: policy.dashboardAdminRoleId,
            supportRoleIds: policy.supportRoleIds ?? [],
        })
            ? "allowed"
            : "denied"
    } catch {
        return "unverifiable"
    }
}
