/**
 * Wall-clock helpers for the seed plan. The clan time zone is always passed in;
 * nothing here reads the process clock or environment.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const MINUTE_MS = 60 * 1000
const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/

/** `"HH:MM"` (24-hour, zero-padded) to minutes after midnight; anything else is null. */
export function parseClock(value: string): number | null {
    const match = CLOCK.exec(value)
    return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

/** Minutes after midnight (0 … 1439) to `"HH:MM"`. */
export function formatClock(minutes: number): string {
    if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 24 * 60)
        throw new RangeError("Clock minutes out of range.")
    const hours = Math.floor(minutes / 60)
    return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

const formatters = new Map<string, Intl.DateTimeFormat>()
function formatter(timeZone: string) {
    let value = formatters.get(timeZone)
    if (!value) {
        value = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        })
        formatters.set(timeZone, value)
    }
    return value
}

export function isValidTimeZone(timeZone: string): boolean {
    if (!timeZone) return false
    try {
        formatter(timeZone)
        return true
    } catch {
        return false
    }
}

/**
 * The clan's zone for seed schedules. Like event recurrence, a clan without a
 * configured or valid zone uses UTC.
 */
export function resolveClanTimeZone(value: string | null | undefined): string {
    return value && isValidTimeZone(value) ? value : "UTC"
}

/** A local calendar day as days since 1970-01-01. Day 0 was a Thursday. */
export function weekdayOfDay(day: number): number {
    return (((day + 4) % 7) + 7) % 7
}

/** `YYYY-MM-DD` of a local calendar day number. */
export function dateOfDay(day: number): string {
    return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

export type LocalMoment = {
    /** Local calendar day as days since 1970-01-01. */
    day: number
    /** 0 = Sunday … 6 = Saturday, as in event recurrence. */
    weekday: number
    /** Local minutes after midnight. */
    minutes: number
    /** Local date, `YYYY-MM-DD`. */
    date: string
}

/** The wall-clock reading of an instant in a zone. Throws for an unknown zone. */
export function localMoment(ms: number, timeZone: string): LocalMoment {
    const parts = formatter(timeZone).formatToParts(new Date(ms))
    const part = (type: string) =>
        Number(parts.find((entry) => entry.type === type)?.value ?? "0")
    const day = Math.floor(
        Date.UTC(part("year"), part("month") - 1, part("day")) / DAY_MS
    )
    return {
        day,
        weekday: weekdayOfDay(day),
        minutes: part("hour") * 60 + part("minute"),
        date: dateOfDay(day),
    }
}

function offsetMs(ms: number, timeZone: string) {
    const local = localMoment(ms, timeZone)
    const asUtc = local.day * DAY_MS + local.minutes * MINUTE_MS
    return asUtc - Math.floor(ms / MINUTE_MS) * MINUTE_MS
}

/**
 * The instant of a local day and wall-clock time in a zone, stable across DST
 * changes. A time skipped by a DST jump resolves to the instant just after it.
 */
export function zonedInstant(
    day: number,
    minutes: number,
    timeZone: string
): number {
    const guess = day * DAY_MS + minutes * MINUTE_MS
    const first = guess - offsetMs(guess, timeZone)
    return guess - offsetMs(first, timeZone)
}
