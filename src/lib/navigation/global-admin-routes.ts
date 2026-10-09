/** Dashboard sections that belong to Logi's global administration. */
export const GLOBAL_ADMIN_SECTIONS = [
    "competitions",
    "teams",
    "games",
    "team-requests",
    "bot",
    "platform-settings",
] as const
export type GlobalAdminSection = (typeof GLOBAL_ADMIN_SECTIONS)[number]

/**
 * The global administration section a dashboard path is in, or `null` for
 * clan pages and the rest of the dashboard. `/cs/dashboard/teams` is the
 * global catalogue; `/cs/dashboard/servers/<id>/teams` is a clan page.
 */
export function globalAdminSection(
    pathname: string | null | undefined
): GlobalAdminSection | null {
    const [, , dashboard, section] = (pathname ?? "")
        .split(/[?#]/)[0]
        .split("/")
    if (dashboard !== "dashboard") return null
    return (GLOBAL_ADMIN_SECTIONS as readonly string[]).includes(section)
        ? (section as GlobalAdminSection)
        : null
}

/** Shown on the pending-requests badge: the count, capped with a plus. */
export function pendingBadgeLabel(count: number, more: boolean): string | null {
    if (count <= 0) return null
    return more ? `${count}+` : String(count)
}
