/**
 * Pure presentation rules for the clan calendar: localized weekday and month
 * labels, the day key of a grid cell, and the checks a manual calendar item
 * must pass before it is saved. Time zones and locales are explicit inputs.
 */

/** Monday-first short weekday names in the given BCP 47 locale. */
export function getWeekdayLabels(intlLocale: string): string[] {
    const formatter = new Intl.DateTimeFormat(intlLocale, {
        weekday: "short",
        timeZone: "UTC",
    })
    // 2024-01-01 was a Monday.
    return Array.from({ length: 7 }, (_, index) =>
        formatter.format(new Date(Date.UTC(2024, 0, 1 + index)))
    )
}

/** "October 2026" / "říjen 2026" for the month that contains `month`. */
export function getMonthLabel(
    month: { year: number; monthIndex: number },
    intlLocale: string
): string {
    return new Intl.DateTimeFormat(intlLocale, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(new Date(Date.UTC(month.year, month.monthIndex, 1)))
}

/**
 * The `yyyy-mm-dd` key of a calendar grid cell. Grid cells are calendar dates,
 * not instants, so the key comes from the date parts and never shifts with the
 * browser or clan time zone.
 */
export function getGridDayKey(day: {
    year: number
    monthIndex: number
    date: number
}): string {
    return `${String(day.year).padStart(4, "0")}-${String(day.monthIndex + 1).padStart(2, "0")}-${String(day.date).padStart(2, "0")}`
}

export type CalendarItemRangeError =
    "title_required" | "start_required" | "end_required" | "end_before_start"

/**
 * Checks a manual calendar item before it is sent. `startAt` and `endAt` are
 * ISO instants already converted from the clan time zone.
 */
export function validateCalendarItemInput(input: {
    title: string
    startAt: string | null
    endAt: string | null
}): Partial<Record<"title" | "startAt" | "endAt", CalendarItemRangeError>> {
    const errors: Partial<
        Record<"title" | "startAt" | "endAt", CalendarItemRangeError>
    > = {}
    if (!input.title.trim()) errors.title = "title_required"
    const start = input.startAt ? Date.parse(input.startAt) : Number.NaN
    const end = input.endAt ? Date.parse(input.endAt) : Number.NaN
    if (Number.isNaN(start)) errors.startAt = "start_required"
    if (Number.isNaN(end)) errors.endAt = "end_required"
    if (!Number.isNaN(start) && !Number.isNaN(end) && end < start)
        errors.endAt = "end_before_start"
    return errors
}
