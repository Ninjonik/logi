function dayNumber(ms: number, timeZone: string) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date(ms))
    const value = (type: string) =>
        Number(parts.find((part) => part.type === type)?.value)
    return Date.UTC(value("year"), value("month") - 1, value("day")) / 86400000
}

/**
 * Calendar days from `now` to `target` in the clan's time zone: 0 today,
 * 1 tomorrow, -1 yesterday. An unknown time zone falls back to UTC;
 * invalid instants give undefined.
 */
export function calendarDayOffset(
    target: number,
    now: number,
    timeZone: string
): number | undefined {
    if (!Number.isFinite(target) || !Number.isFinite(now)) return undefined
    let zone = timeZone
    try {
        new Intl.DateTimeFormat("en-CA", { timeZone: zone })
    } catch {
        zone = "UTC"
    }
    return Math.round(dayNumber(target, zone) - dayNumber(now, zone))
}
