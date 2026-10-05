import type { Guild } from "@/types/domain"

/**
 * Whether the signed-in person manages this clan in the dashboard. A per-person
 * override set by the clan wins over the Discord-derived admin flags.
 */
export function canAdminWorkspace(
    server: Pick<Guild, "canAdmin" | "adminIds" | "adminAccessOverrides">,
    userDiscordId: string
): boolean {
    return (
        server.adminAccessOverrides?.[userDiscordId] ??
        Boolean(server.canAdmin || server.adminIds.includes(userDiscordId))
    )
}
