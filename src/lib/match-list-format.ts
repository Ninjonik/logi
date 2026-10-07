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

/**
 * "repeats every Wednesday" for a weekly series in a row's detail line; other
 * schedules use the full description.
 */
export function describeRepeat(
    recurrence: MatchRecurrence,
    dictionary: Dictionary,
    locale: string
) {
    const text = dictionary.matchList.recurrence
    const interval = Math.max(1, Math.trunc(recurrence.interval || 1))
    const days = recurrence.weekdays.filter(
        (day) => Number.isInteger(day) && day >= 0 && day <= 6
    )
    if (recurrence.frequency !== "weekly" || interval !== 1 || !days.length)
        return describeRecurrence(recurrence, dictionary, locale)
    const phrases = days.map((day) => text.every[day])
    const list =
        phrases.length > 1
            ? `${phrases.slice(0, -1).join(", ")} ${text.and} ${phrases.at(-1)}`
            : phrases[0]
    return text.repeats.replace("{days}", list)
}

function zoneOrUtc(timeZone: string) {
    try {
        new Intl.DateTimeFormat("en", { timeZone })
        return timeZone
    } catch {
        return "UTC"
    }
}

/**
 * Parts of a date in the clan's time zone for the list: "ne 11. 10." (`date`),
 * "11. 10." (`day`), "ne" (`weekday`) and "20:00" (`time`).
 */
export function formatListDate(
    iso: string,
    locale: string,
    timeZone: string
): { date: string; day: string; weekday: string; time: string } {
    const zone = zoneOrUtc(timeZone)
    const value = new Date(iso)
    const format = (options: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(intlLocale(locale), {
            timeZone: zone,
            ...options,
        }).format(value)
    return {
        date: format({ weekday: "short", day: "numeric", month: "numeric" }),
        day: format({ day: "numeric", month: "numeric" }),
        weekday: format({ weekday: "short" }),
        time: format({ hour: "2-digit", minute: "2-digit" }),
    }
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * "út 19:30" for a moment within the next six days, where the weekday is
 * unambiguous; "24. 10. 18:00" further ahead or in the past.
 */
export function formatDeadline(
    iso: string,
    now: Date,
    locale: string,
    timeZone: string
) {
    const parts = formatListDate(iso, locale, timeZone)
    const ahead = Date.parse(iso) - now.getTime()
    return ahead >= 0 && ahead < 6 * DAY_MS
        ? `${parts.weekday} ${parts.time}`
        : `${parts.day} ${parts.time}`
}
