import type { EventUpsertInput } from "./upsert-policy"

/** How far ahead a weekly series is created ("two weeks ahead"). */
export const RECURRENCE_HORIZON_DAYS = 14
/** Upper bound of occurrences created for one series in one pass. */
export const MAX_OCCURRENCES_PER_PASS = 14

const DAY_MS = 24 * 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

export type WeeklyRecurrence = {
    frequency: "weekly" | "monthly_date" | "monthly_nth_weekday"
    interval: number
    /** 0 = Sunday … 6 = Saturday. */
    weekdays: number[]
}

type LocalParts = {
    year: number
    month: number
    day: number
    hour: number
    minute: number
}

function localParts(ms: number, timeZone: string): LocalParts {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(new Date(ms))
    const part = (type: string) =>
        Number(parts.find((entry) => entry.type === type)?.value ?? "0")
    return {
        year: part("year"),
        month: part("month"),
        day: part("day"),
        hour: part("hour"),
        minute: part("minute"),
    }
}

function offsetMs(ms: number, timeZone: string) {
    const local = localParts(ms, timeZone)
    const asUtc = Date.UTC(
        local.year,
        local.month - 1,
        local.day,
        local.hour,
        local.minute
    )
    return asUtc - Math.floor(ms / MINUTE_MS) * MINUTE_MS
}

/** The instant of a wall-clock time in a zone, stable across DST changes. */
function zonedToUtc(
    dayNumber: number,
    hour: number,
    minute: number,
    timeZone: string
) {
    const guess = dayNumber * DAY_MS + (hour * 60 + minute) * MINUTE_MS
    const first = guess - offsetMs(guess, timeZone)
    return guess - offsetMs(first, timeZone)
}

function isValidZone(timeZone: string) {
    try {
        new Intl.DateTimeFormat("en", { timeZone })
        return true
    } catch {
        return false
    }
}

/**
 * Start instants of a weekly series after `after` and up to `until`: the
 * series' local start time on each chosen weekday of every `interval`-th week
 * counted from the series start, in the clan's time zone. Monthly series are
 * not generated (they return nothing).
 */
export function weeklyOccurrenceStarts(input: {
    seriesStart: string
    timeZone: string
    recurrence: WeeklyRecurrence
    after: string
    until: string
    limit?: number
}): string[] {
    if (input.recurrence.frequency !== "weekly") return []
    const seriesMs = Date.parse(input.seriesStart)
    const afterMs = Date.parse(input.after)
    const untilMs = Date.parse(input.until)
    if (![seriesMs, afterMs, untilMs].every(Number.isFinite)) return []
    const timeZone = isValidZone(input.timeZone) ? input.timeZone : "UTC"
    const interval = Math.max(1, Math.trunc(input.recurrence.interval || 1))
    const limit = input.limit ?? MAX_OCCURRENCES_PER_PASS
    const start = localParts(seriesMs, timeZone)
    const startDay = Math.floor(
        Date.UTC(start.year, start.month - 1, start.day) / DAY_MS
    )
    // Day 0 (1970-01-01) was a Thursday.
    const weekdayOf = (day: number) => (((day + 4) % 7) + 7) % 7
    const weekStart = startDay - weekdayOf(startDay)
    const weekdays = new Set(
        input.recurrence.weekdays.filter(
            (day) => Number.isInteger(day) && day >= 0 && day <= 6
        )
    )
    if (!weekdays.size) weekdays.add(weekdayOf(startDay))
    const firstDay = Math.max(startDay + 1, Math.floor(afterMs / DAY_MS) - 1)
    const lastDay = Math.floor(untilMs / DAY_MS) + 1
    const starts: string[] = []
    for (let day = firstDay; day <= lastDay && starts.length < limit; day++) {
        if (!weekdays.has(weekdayOf(day))) continue
        if (Math.floor((day - weekStart) / 7) % interval !== 0) continue
        const at = zonedToUtc(day, start.hour, start.minute, timeZone)
        if (at > afterMs && at <= untilMs && at > seriesMs)
            starts.push(new Date(at).toISOString())
    }
    return starts
}

type SeriesTimes = {
    registrationStart?: string
    registrationEnd: string
    meetingStart: string
    gameStart: string
    gameEnd: string
}

/**
 * The next occurrence of a series: the series event's settings with every
 * deadline moved by the same amount as the start, no sign-ups, no recurrence
 * of its own (the series event keeps it) and a pointer to the series.
 */
export function recurringOccurrenceInput(
    series: Omit<EventUpsertInput, "recurrence" | "matchTeams"> & SeriesTimes,
    startIso: string
): EventUpsertInput {
    const delta = Date.parse(startIso) - Date.parse(series.gameStart)
    const shift = (iso: string) =>
        new Date(Date.parse(iso) + delta).toISOString()
    return {
        ...series,
        registrationStart: series.registrationStart
            ? shift(series.registrationStart)
            : undefined,
        registrationEnd: shift(series.registrationEnd),
        meetingStart: shift(series.meetingStart),
        gameStart: startIso,
        gameEnd: shift(series.gameEnd),
        recurrence: undefined,
    }
}
