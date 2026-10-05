const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * "2 hours ago" / "před 2 h" style age of a past instant, for lists where the
 * exact time matters less than how long something has waited. Older than a
 * week, or in the future, it falls back to the date.
 */
export function formatRelativeTime(
    iso: string,
    now: number,
    locale: string
): string {
    const at = Date.parse(iso)
    if (Number.isNaN(at)) return iso
    const age = now - at
    const relative = new Intl.RelativeTimeFormat(locale, {
        numeric: "auto",
        style: "short",
    })
    if (age < 0 || age >= 7 * DAY)
        return new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "numeric",
            year: "numeric",
        }).format(at)
    if (age < HOUR) return relative.format(-Math.floor(age / MINUTE), "minute")
    if (age < DAY) return relative.format(-Math.floor(age / HOUR), "hour")
    return relative.format(-Math.floor(age / DAY), "day")
}
