import { defaultLocale, isLocale, type Locale } from "@/i18n/config"

/** Why the Discord sign-in failed; the login page explains each one. */
export const LOGIN_ERRORS = ["oauth-state", "discord-login"] as const
export type LoginError = (typeof LOGIN_ERRORS)[number]

export function parseLoginError(value: unknown): LoginError | null {
    return typeof value === "string" &&
        (LOGIN_ERRORS as readonly string[]).includes(value)
        ? (value as LoginError)
        : null
}

/** The language of a local path such as `/cs/dashboard`, or the default. */
export function localeOfPath(path: string): Locale {
    const segment = path.split(/[/?#]/)[1] ?? ""
    return isLocale(segment) ? segment : defaultLocale
}

/**
 * The login page a failed sign-in returns to: in the language the person
 * started from, with the error to explain and the page to continue to.
 * `redirectTo` must already be a sanitized local path.
 */
export function loginErrorPath(redirectTo: string, error: LoginError): string {
    const locale = localeOfPath(redirectTo)
    const query = new URLSearchParams({ error })
    if (redirectTo !== `/${locale}/dashboard`)
        query.set("redirectTo", redirectTo)
    return `/${locale}/login?${query.toString()}`
}
