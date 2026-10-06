/**
 * The clan's bot language: which languages exist, how an unknown value
 * resolves, the Intl locale of each language and the date helpers that
 * format in it. The copy itself lives in feature modules next to this file
 * (events, panels, membership, commands, system); each one reads its entry
 * through {@link clanCopy}.
 */

export const supportedClanLanguages = ["en", "cs", "de"] as const

export type ClanLanguage = (typeof supportedClanLanguages)[number]

const clanLocales: Record<ClanLanguage, string> = {
    en: "en-GB",
    cs: "cs-CZ",
    de: "de-DE",
}

export function isClanLanguage(
    value: string | undefined | null
): value is ClanLanguage {
    return supportedClanLanguages.includes((value ?? "") as ClanLanguage)
}

/** The clan language, or English when the value is missing or unknown. */
export function resolveClanLanguage(language?: string | null): ClanLanguage {
    return isClanLanguage(language) ? language : "en"
}

/** The Intl locale (`cs-CZ`, …) for formatting dates and numbers in the clan language. */
export function getIntlLocaleForClanLanguage(language?: string | null) {
    return clanLocales[resolveClanLanguage(language)]
}

/**
 * A getter for one feature's copy. It returns the clan language's entry with
 * the language's Intl `locale` added; unknown languages read English.
 */
export function clanCopy<T extends object>(copies: Record<ClanLanguage, T>) {
    const resolved = Object.fromEntries(
        supportedClanLanguages.map((language) => [
            language,
            { locale: clanLocales[language], ...copies[language] },
        ])
    ) as Record<ClanLanguage, T & { locale: string }>
    return (language?: string | null): T & { locale: string } =>
        resolved[resolveClanLanguage(language)]
}

const DAY_MS = 86_400_000

/**
 * A date and time the way Discord's `<t:…:f>` shows it, in the clan
 * language (e.g. "11. října 2026 20:00"). Invalid input gives undefined.
 */
export function formatClanDateTime(
    language: string | null | undefined,
    value: number | Date,
    timeZone?: string
) {
    const date = typeof value === "number" ? new Date(value) : value
    if (!Number.isFinite(date.getTime())) return undefined
    return new Intl.DateTimeFormat(getIntlLocaleForClanLanguage(language), {
        dateStyle: "long",
        timeStyle: "short",
        ...(timeZone ? { timeZone } : {}),
    }).format(date)
}

/**
 * A relative time the way Discord's `<t:…:R>` shows it ("před 2 minutami",
 * "za 6 dní"), in the clan language. `now` is explicit so callers stay
 * deterministic.
 */
export function formatClanRelativeTime(
    language: string | null | undefined,
    value: number | Date,
    now: number
) {
    const at = typeof value === "number" ? value : value.getTime()
    if (!Number.isFinite(at) || !Number.isFinite(now)) return undefined
    const seconds = Math.round((at - now) / 1000)
    const format = new Intl.RelativeTimeFormat(
        getIntlLocaleForClanLanguage(language),
        { numeric: "always" }
    )
    const abs = Math.abs(seconds)
    if (abs < 60) return format.format(seconds, "second")
    if (abs < 3600) return format.format(Math.round(seconds / 60), "minute")
    if (abs < DAY_MS / 1000)
        return format.format(Math.round(seconds / 3600), "hour")
    if (abs < (30 * DAY_MS) / 1000)
        return format.format(Math.round((seconds * 1000) / DAY_MS), "day")
    if (abs < (365 * DAY_MS) / 1000)
        return format.format(
            Math.round((seconds * 1000) / (30 * DAY_MS)),
            "month"
        )
    return format.format(Math.round((seconds * 1000) / (365 * DAY_MS)), "year")
}
