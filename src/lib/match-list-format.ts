import type { Dictionary } from "@/i18n/dictionaries"
import type { MatchRecurrence } from "@/types/domain"

export function intlLocale(locale: string) {
    return locale === "cs" ? "cs-CZ" : locale === "de" ? "de-DE" : "en-GB"
}

/** Weekday name for 0 = Sunday … 6 = Saturday, as stored in match recurrences. */
function weekdayName(day: number, locale: string) {
    return new Intl.DateTimeFormat(intlLocale(locale), {
        weekday: "long",
        timeZone: "UTC",
    }).format(new Date(Date.UTC(2024, 0, 7 + day)))
}

/** One line such as "Every week on Wednesday" for a recurring match. */
export function describeRecurrence(
    recurrence: MatchRecurrence,
    dictionary: Dictionary,
    locale: string
) {
    const text = dictionary.matchList.recurrence
    const interval = Math.max(1, Math.trunc(recurrence.interval || 1))
    switch (recurrence.frequency) {
        case "weekly": {
            const days = recurrence.weekdays
                .map((day) => weekdayName(day, locale))
                .join(", ")
            return (interval === 1 ? text.weekly : text.everyWeeks)
                .replace("{count}", String(interval))
                .replace("{days}", days)
        }
        case "monthly_date":
            return text.monthlyDate.replace(
                "{day}",
                String(recurrence.monthDay ?? 1)
            )
        case "monthly_nth_weekday":
            return text.monthlyWeekday
                .replace("{nth}", String(recurrence.nth ?? 1))
                .replace("{day}", weekdayName(recurrence.weekday ?? 0, locale))
    }
}

/** "ne 11. 10." style short date and "20:00" time in the clan's time zone. */
export function formatListDate(
    iso: string,
    locale: string,
    timeZone: string
): { date: string; time: string } {
    const options = { timeZone } as const
    let zone = timeZone
    try {
        new Intl.DateTimeFormat("en", options)
    } catch {
        zone = "UTC"
    }
    const value = new Date(iso)
    return {
        date: new Intl.DateTimeFormat(intlLocale(locale), {
            timeZone: zone,
            weekday: "short",
            day: "numeric",
            month: "numeric",
        }).format(value),
        time: new Intl.DateTimeFormat(intlLocale(locale), {
            timeZone: zone,
            hour: "2-digit",
            minute: "2-digit",
        }).format(value),
    }
}
