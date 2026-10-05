/** Dashboard pages that belong to Logi's global administration, not to a clan. */
export const GLOBAL_ADMIN_PAGES = [
    "competitions",
    "teams",
    "team-requests",
    "bot",
    "platform-settings",
] as const

export type GlobalAdminPage = (typeof GLOBAL_ADMIN_PAGES)[number]

const GLOBAL_ADMIN_PATH = new RegExp(
    `^/[^/]+/dashboard/(${GLOBAL_ADMIN_PAGES.join("|")})(/|$)`
)

/**
 * Whether a pathname is a global administration page. The dashboard shell
 * switches to the global administration sidebar on these pages.
 */
export function isGlobalAdminPath(pathname: string | null | undefined) {
    return Boolean(pathname && GLOBAL_ADMIN_PATH.test(pathname))
}

export function globalAdminHref(
    locale: string,
    page: GlobalAdminPage,
    query = ""
) {
    return `/${locale}/dashboard/${page}${query}`
}
