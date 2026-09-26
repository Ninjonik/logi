import type { CalendarItem, EventRecord } from "@/types/domain"

type FeedInput = {
    clanName: string
    events: EventRecord[]
    calendarItems: CalendarItem[]
    now?: Date
}

export function buildICalendarFeed({
    clanName,
    events,
    calendarItems,
    now = new Date(),
}: FeedInput) {
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Logi//Clan calendar//EN",
        "CALSCALE:GREGORIAN",
        `X-WR-CALNAME:${escapeText(clanName)}`,
    ]

    for (const event of events) {
        lines.push(...eventLines(event, now))
    }
    for (const item of calendarItems) {
        lines.push(...calendarItemLines(item, now))
    }

    lines.push("END:VCALENDAR", "")
    return lines.join("\r\n")
}

function eventLines(event: EventRecord, now: Date) {
    return [
        "BEGIN:VEVENT",
        `UID:logi-event-${event.id}@logi`,
        `DTSTAMP:${formatDateTime(now)}`,
        `DTSTART:${formatDateTime(new Date(event.meetingStart))}`,
        `DTEND:${formatDateTime(new Date(event.gameEnd))}`,
        `SUMMARY:${escapeText(event.name)}`,
        ...(event.description
            ? [`DESCRIPTION:${escapeText(event.description)}`]
            : []),
        "END:VEVENT",
    ]
}

function calendarItemLines(item: CalendarItem, now: Date) {
    const dateFields = item.allDay
        ? [
              `DTSTART;VALUE=DATE:${formatDate(new Date(item.startAt))}`,
              // iCalendar all-day DTEND is exclusive.
              `DTEND;VALUE=DATE:${formatDate(addDays(new Date(item.endAt), 1))}`,
          ]
        : [
              `DTSTART:${formatDateTime(new Date(item.startAt))}`,
              `DTEND:${formatDateTime(new Date(item.endAt))}`,
          ]
    const recurrence = item.recurrence ? toRRule(item) : undefined

    return [
        "BEGIN:VEVENT",
        `UID:logi-calendar-item-${item.id}@logi`,
        `DTSTAMP:${formatDateTime(now)}`,
        ...dateFields,
        `SUMMARY:${escapeText(item.title)}`,
        ...(item.description
            ? [`DESCRIPTION:${escapeText(item.description)}`]
            : []),
        ...(recurrence ? [`RRULE:${recurrence}`] : []),
        "END:VEVENT",
    ]
}

function toRRule(item: CalendarItem) {
    const recurrence = item.recurrence!
    const interval = Math.max(1, recurrence.interval)
    const start = new Date(item.startAt)
    const until = recurrence.until
        ? `;UNTIL=${formatDateTime(new Date(recurrence.until))}`
        : ""

    switch (recurrence.frequency) {
        case "weekly":
            return `FREQ=WEEKLY;INTERVAL=${interval}${until}`
        case "monthly_date":
            return `FREQ=MONTHLY;INTERVAL=${interval};BYMONTHDAY=${start.getUTCDate()}${until}`
        case "monthly_nth_weekday": {
            const weekDay = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][
                start.getUTCDay()
            ]
            const isLast =
                new Date(start.getTime() + 7 * 86400000).getUTCMonth() !==
                start.getUTCMonth()
            const position = isLast ? -1 : Math.ceil(start.getUTCDate() / 7)
            return `FREQ=MONTHLY;INTERVAL=${interval};BYDAY=${weekDay};BYSETPOS=${position}${until}`
        }
        case "yearly":
            return `FREQ=YEARLY;INTERVAL=${interval}${until}`
    }
}

function escapeText(value: string) {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n")
}

function formatDateTime(date: Date) {
    return date
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "")
}

function formatDate(date: Date) {
    return date.toISOString().slice(0, 10).replace(/-/g, "")
}

function addDays(date: Date, days: number) {
    return new Date(date.getTime() + days * 86400000)
}
