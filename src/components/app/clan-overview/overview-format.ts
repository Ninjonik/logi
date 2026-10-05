import { calendarDayDistance } from "@/domain/workspaces/clan-overview"
import { pluralize, type PluralForms } from "@/i18n/plural"
import type { Dictionary } from "@/i18n/dictionaries"
import { formatDateKey } from "@/lib/format"
import type { Locale } from "@/i18n/config"

const INTL_LOCALES: Record<Locale, string> = {
    en: "en-GB",
    cs: "cs-CZ",
    de: "de-DE",
}

export function intlLocale(locale: Locale) {
    return INTL_LOCALES[locale]
}

/** Inserts values into `{key}` placeholders literally. */
export function fill(
    template: string,
    values: Readonly<Record<string, string | number>>
) {
    return Object.entries(values).reduce(
        (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
        template
    )
}

/** Formatters bound to the clan's time zone and the reader's language. */
export function overviewFormat(locale: Locale, timezone?: string) {
    const language = intlLocale(locale)
    const time = new Intl.DateTimeFormat(language, {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
    })
    const shortDate = new Intl.DateTimeFormat(language, {
        timeZone: timezone,
        day: "numeric",
        month: "numeric",
    })
    const weekdayDate = new Intl.DateTimeFormat(language, {
        timeZone: timezone,
        weekday: "short",
        day: "numeric",
        month: "numeric",
    })
    const longDate = new Intl.DateTimeFormat(language, {
        timeZone: timezone,
        weekday: "long",
        day: "numeric",
        month: "numeric",
    })
    // Day keys are calendar dates, so they are formatted in UTC.
    const dayCell = new Intl.DateTimeFormat(language, {
        timeZone: "UTC",
        weekday: "short",
        day: "numeric",
    })
    const month = new Intl.DateTimeFormat(language, {
        timeZone: timezone,
        month: "long",
    })
    const dayKey = (iso: string) => formatDateKey(iso, timezone)
    return {
        dayKey,
        /** `YYYY-MM` of the instant in the clan's time zone. */
        monthKey: (iso: string) => dayKey(iso).slice(0, 7),
        /** "říjen", "October": the month's name on its own. */
        monthName: (iso: string) => month.format(new Date(iso)),
        /** Plural-aware count text, e.g. "7 výher". */
        count: (count: number, forms: PluralForms) =>
            pluralize(language, count, forms),
        time: (iso: string) => time.format(new Date(iso)),
        shortDate: (iso: string) => shortDate.format(new Date(iso)),
        /** "Sunday 11. 10.", capitalised to start a line. */
        longDate: (iso: string) => {
            const value = longDate.format(new Date(iso))
            return value.charAt(0).toLocaleUpperCase(language) + value.slice(1)
        },
        /** "Ne 11.", capitalised like the board's day cells. */
        dayCell: (key: string) => {
            const value = dayCell.format(new Date(`${key}T12:00:00Z`))
            return value.charAt(0).toLocaleUpperCase(language) + value.slice(1)
        },
        /** "today at 20:00", "tomorrow at 20:00" or "Tue 13. 10. at 20:00". */
        when: (iso: string, now: Date, text: Dictionary["clanOverview"]) => {
            const distance = calendarDayDistance(
                dayKey(now.toISOString()),
                dayKey(iso)
            )
            const values = {
                time: time.format(new Date(iso)),
                day: weekdayDate.format(new Date(iso)),
            }
            return fill(
                distance === 0
                    ? text.today
                    : distance === 1
                      ? text.tomorrow
                      : text.onDay,
                values
            )
        },
        /** "A", "A and B", "A, B and C". */
        list: (items: string[], and: string) =>
            items.length > 1
                ? `${items.slice(0, -1).join(", ")} ${and} ${items.at(-1)}`
                : (items[0] ?? ""),
    }
}

export type OverviewFormat = ReturnType<typeof overviewFormat>
