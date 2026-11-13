import type { CalendarItem, CalendarItemRecurrence } from "@/types/domain"

export type CalendarItemOccurrence = {
    id: string
    sourceId: string
    guildId: string
    title: string
    description?: string
    color: string
    emoji?: string
    label?: string
    startAt: string
    endAt: string
    allDay: boolean
}

export function expandCalendarItems(
    items: CalendarItem[],
    rangeStart: Date,
    rangeEnd: Date,
    options: { limitPerItem?: number } = {}
) {
    const occurrences: CalendarItemOccurrence[] = []

    for (const item of items) {
        occurrences.push(
            ...expandCalendarItem(
                item,
                rangeStart,
                rangeEnd,
                options.limitPerItem
            )
        )
    }

    return occurrences.sort(
        (left, right) =>
            new Date(left.startAt).getTime() - new Date(right.startAt).getTime()
    )
}

function expandCalendarItem(
    item: CalendarItem,
    rangeStart: Date,
    rangeEnd: Date,
    limit = Infinity
) {
    const baseStart = new Date(item.startAt)
    const baseEnd = new Date(item.endAt)
    const recurrence = item.recurrence
    if (
        ![baseStart, baseEnd, rangeStart, rangeEnd].every((date) =>
            Number.isFinite(date.getTime())
        ) ||
        rangeEnd < rangeStart ||
        baseEnd < baseStart ||
        limit <= 0
    )
        return []

    if (!recurrence) {
        return overlapsRange(baseStart, baseEnd, rangeStart, rangeEnd)
            ? [toOccurrence(item, baseStart, baseEnd, 0)]
            : []
    }

    if (!Number.isSafeInteger(recurrence.interval) || recurrence.interval < 1)
        return []
    const durationMs = baseEnd.getTime() - baseStart.getTime()
    const until = recurrence.until
        ? new Date(recurrence.until).getTime()
        : Infinity
    if (Number.isNaN(until)) return []
    const end = new Date(Math.min(rangeEnd.getTime(), until))
    if (end < baseStart) return []
    const occurrences: CalendarItemOccurrence[] = []
    // Seek to the overlap window, preserving the original series index. Historical
    // occurrences never consume a current-window iteration budget.
    const first = Math.max(
        0,
        approximateIndex(
            baseStart,
            recurrence,
            new Date(rangeStart.getTime() - durationMs)
        ) - 1
    )
    const last = Math.max(0, approximateIndex(baseStart, recurrence, end) + 1)
    for (
        let occurrenceIndex = first;
        occurrenceIndex <= last && occurrences.length < limit;
        occurrenceIndex++
    ) {
        const currentStart =
            occurrenceIndex === 0
                ? baseStart
                : getNextOccurrenceStart(baseStart, recurrence, occurrenceIndex)
        if (!currentStart || !Number.isFinite(currentStart.getTime())) continue
        if (currentStart.getTime() > end.getTime()) continue
        const currentEnd = new Date(currentStart.getTime() + durationMs)
        if (
            Number.isFinite(currentEnd.getTime()) &&
            overlapsRange(currentStart, currentEnd, rangeStart, rangeEnd)
        )
            occurrences.push(
                toOccurrence(item, currentStart, currentEnd, occurrenceIndex)
            )
    }

    return occurrences
}

function approximateIndex(
    base: Date,
    recurrence: CalendarItemRecurrence,
    at: Date
) {
    switch (recurrence.frequency) {
        case "weekly":
            return Math.floor(
                (at.getTime() - base.getTime()) /
                    (recurrence.interval * 7 * 86400000)
            )
        case "monthly_date":
        case "monthly_nth_weekday":
            return Math.floor(
                ((at.getUTCFullYear() - base.getUTCFullYear()) * 12 +
                    at.getUTCMonth() -
                    base.getUTCMonth()) /
                    recurrence.interval
            )
        case "yearly":
            return Math.floor(
                (at.getUTCFullYear() - base.getUTCFullYear()) /
                    recurrence.interval
            )
    }
}

function toOccurrence(
    item: CalendarItem,
    startAt: Date,
    endAt: Date,
    occurrenceIndex: number
): CalendarItemOccurrence {
    return {
        id: `${item.id}:${occurrenceIndex}`,
        sourceId: item.id,
        guildId: item.guildId,
        title: item.title,
        description: item.description,
        color: item.color,
        emoji: item.emoji,
        label: item.label,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        allDay: item.allDay,
    }
}

function overlapsRange(
    startAt: Date,
    endAt: Date,
    rangeStart: Date,
    rangeEnd: Date
) {
    return (
        endAt.getTime() >= rangeStart.getTime() &&
        startAt.getTime() <= rangeEnd.getTime()
    )
}

function getNextOccurrenceStart(
    baseStart: Date,
    recurrence: CalendarItemRecurrence,
    occurrenceIndex: number
) {
    switch (recurrence.frequency) {
        case "weekly":
            return new Date(
                baseStart.getTime() +
                    occurrenceIndex *
                        recurrence.interval *
                        7 *
                        24 *
                        60 *
                        60 *
                        1000
            )
        case "monthly_date":
            return getMonthlyDateOccurrence(
                baseStart,
                recurrence.interval,
                occurrenceIndex
            )
        case "monthly_nth_weekday":
            return getMonthlyNthWeekdayOccurrence(
                baseStart,
                recurrence.interval,
                occurrenceIndex
            )
        case "yearly":
            return getYearlyOccurrence(
                baseStart,
                recurrence.interval,
                occurrenceIndex
            )
    }
}

function getMonthlyDateOccurrence(
    baseStart: Date,
    interval: number,
    occurrenceIndex: number
) {
    const targetMonthIndex =
        baseStart.getUTCMonth() + interval * occurrenceIndex
    const year = baseStart.getUTCFullYear() + Math.floor(targetMonthIndex / 12)
    const month = ((targetMonthIndex % 12) + 12) % 12
    const candidate = new Date(
        Date.UTC(
            year,
            month,
            baseStart.getUTCDate(),
            baseStart.getUTCHours(),
            baseStart.getUTCMinutes(),
            baseStart.getUTCSeconds(),
            baseStart.getUTCMilliseconds()
        )
    )

    if (candidate.getUTCMonth() !== month) {
        return null
    }

    return candidate
}

function getMonthlyNthWeekdayOccurrence(
    baseStart: Date,
    interval: number,
    occurrenceIndex: number
) {
    const targetMonthIndex =
        baseStart.getUTCMonth() + interval * occurrenceIndex
    const year = baseStart.getUTCFullYear() + Math.floor(targetMonthIndex / 12)
    const month = ((targetMonthIndex % 12) + 12) % 12
    const weekday = baseStart.getUTCDay()
    const date = baseStart.getUTCDate()
    const nth = isLastWeekdayOfMonth(baseStart) ? -1 : Math.ceil(date / 7)
    const dayOfMonth =
        nth === -1
            ? getLastWeekdayOfMonth(year, month, weekday)
            : getNthWeekdayOfMonth(year, month, weekday, nth)

    return new Date(
        Date.UTC(
            year,
            month,
            dayOfMonth,
            baseStart.getUTCHours(),
            baseStart.getUTCMinutes(),
            baseStart.getUTCSeconds(),
            baseStart.getUTCMilliseconds()
        )
    )
}

function getYearlyOccurrence(
    baseStart: Date,
    interval: number,
    occurrenceIndex: number
) {
    const year = baseStart.getUTCFullYear() + interval * occurrenceIndex
    const month = baseStart.getUTCMonth()
    const candidate = new Date(
        Date.UTC(
            year,
            month,
            baseStart.getUTCDate(),
            baseStart.getUTCHours(),
            baseStart.getUTCMinutes(),
            baseStart.getUTCSeconds(),
            baseStart.getUTCMilliseconds()
        )
    )

    if (candidate.getUTCMonth() !== month) {
        return null
    }

    return candidate
}

function isLastWeekdayOfMonth(date: Date) {
    const nextSameWeekday = new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000)
    return nextSameWeekday.getUTCMonth() !== date.getUTCMonth()
}

function getNthWeekdayOfMonth(
    year: number,
    month: number,
    weekday: number,
    nth: number
) {
    const firstOfMonth = new Date(Date.UTC(year, month, 1))
    const offset = (weekday - firstOfMonth.getUTCDay() + 7) % 7
    return 1 + offset + (nth - 1) * 7
}

function getLastWeekdayOfMonth(year: number, month: number, weekday: number) {
    const lastOfMonth = new Date(Date.UTC(year, month + 1, 0))
    const offset = (lastOfMonth.getUTCDay() - weekday + 7) % 7
    return lastOfMonth.getUTCDate() - offset
}
