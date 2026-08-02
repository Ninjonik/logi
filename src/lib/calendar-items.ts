import type { CalendarItem, CalendarItemRecurrence } from "@/types/domain";

export type CalendarItemOccurrence = {
  id: string;
  sourceId: string;
  guildId: string;
  title: string;
  description?: string;
  color: string;
  emoji?: string;
  label?: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
};

export function expandCalendarItems(
  items: CalendarItem[],
  rangeStart: Date,
  rangeEnd: Date,
) {
  const occurrences: CalendarItemOccurrence[] = [];

  for (const item of items) {
    occurrences.push(...expandCalendarItem(item, rangeStart, rangeEnd));
  }

  return occurrences.sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime());
}

function expandCalendarItem(item: CalendarItem, rangeStart: Date, rangeEnd: Date) {
  const baseStart = new Date(item.startAt);
  const baseEnd = new Date(item.endAt);
  const recurrence = item.recurrence;

  if (!recurrence) {
    return overlapsRange(baseStart, baseEnd, rangeStart, rangeEnd)
      ? [toOccurrence(item, baseStart, baseEnd, 0)]
      : [];
  }

  const durationMs = Math.max(0, baseEnd.getTime() - baseStart.getTime());
  const occurrences: CalendarItemOccurrence[] = [];
  let occurrenceIndex = 0;
  let currentStart = baseStart;

  while (occurrenceIndex < 512 && currentStart.getTime() <= rangeEnd.getTime()) {
    const currentEnd = new Date(currentStart.getTime() + durationMs);

    if (currentStart.getTime() >= baseStart.getTime()) {
      if (recurrence.until && currentStart.getTime() > new Date(recurrence.until).getTime()) {
        break;
      }

      if (overlapsRange(currentStart, currentEnd, rangeStart, rangeEnd)) {
        occurrences.push(toOccurrence(item, currentStart, currentEnd, occurrenceIndex));
      }
    }

    occurrenceIndex += 1;
    currentStart = getNextOccurrenceStart(baseStart, recurrence, occurrenceIndex);
  }

  return occurrences;
}

function toOccurrence(item: CalendarItem, startAt: Date, endAt: Date, occurrenceIndex: number): CalendarItemOccurrence {
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
  };
}

function overlapsRange(startAt: Date, endAt: Date, rangeStart: Date, rangeEnd: Date) {
  return endAt.getTime() >= rangeStart.getTime() && startAt.getTime() <= rangeEnd.getTime();
}

function getNextOccurrenceStart(baseStart: Date, recurrence: CalendarItemRecurrence, occurrenceIndex: number) {
  switch (recurrence.frequency) {
    case "weekly":
      return new Date(baseStart.getTime() + occurrenceIndex * recurrence.interval * 7 * 24 * 60 * 60 * 1000);
    case "monthly_date":
      return getMonthlyDateOccurrence(baseStart, recurrence.interval, occurrenceIndex);
    case "monthly_nth_weekday":
      return getMonthlyNthWeekdayOccurrence(baseStart, recurrence.interval, occurrenceIndex);
    case "yearly":
      return getYearlyOccurrence(baseStart, recurrence.interval, occurrenceIndex);
  }
}

function getMonthlyDateOccurrence(baseStart: Date, interval: number, occurrenceIndex: number) {
  const targetMonthIndex = (baseStart.getUTCMonth() + interval * occurrenceIndex);
  const year = baseStart.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12;
  const candidate = new Date(Date.UTC(
    year,
    month,
    baseStart.getUTCDate(),
    baseStart.getUTCHours(),
    baseStart.getUTCMinutes(),
    baseStart.getUTCSeconds(),
    baseStart.getUTCMilliseconds(),
  ));

  if (candidate.getUTCMonth() !== month) {
    return getMonthlyDateOccurrence(baseStart, interval, occurrenceIndex + 1);
  }

  return candidate;
}

function getMonthlyNthWeekdayOccurrence(baseStart: Date, interval: number, occurrenceIndex: number) {
  const targetMonthIndex = baseStart.getUTCMonth() + interval * occurrenceIndex;
  const year = baseStart.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12;
  const weekday = baseStart.getUTCDay();
  const date = baseStart.getUTCDate();
  const nth = isLastWeekdayOfMonth(baseStart) ? -1 : Math.ceil(date / 7);
  const dayOfMonth = nth === -1
    ? getLastWeekdayOfMonth(year, month, weekday)
    : getNthWeekdayOfMonth(year, month, weekday, nth);

  return new Date(Date.UTC(
    year,
    month,
    dayOfMonth,
    baseStart.getUTCHours(),
    baseStart.getUTCMinutes(),
    baseStart.getUTCSeconds(),
    baseStart.getUTCMilliseconds(),
  ));
}

function getYearlyOccurrence(baseStart: Date, interval: number, occurrenceIndex: number) {
  const year = baseStart.getUTCFullYear() + interval * occurrenceIndex;
  const month = baseStart.getUTCMonth();
  const candidate = new Date(Date.UTC(
    year,
    month,
    baseStart.getUTCDate(),
    baseStart.getUTCHours(),
    baseStart.getUTCMinutes(),
    baseStart.getUTCSeconds(),
    baseStart.getUTCMilliseconds(),
  ));

  if (candidate.getUTCMonth() !== month) {
    return getYearlyOccurrence(baseStart, interval, occurrenceIndex + 1);
  }

  return candidate;
}

function isLastWeekdayOfMonth(date: Date) {
  const nextSameWeekday = new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
  return nextSameWeekday.getUTCMonth() !== date.getUTCMonth();
}

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number) {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - firstOfMonth.getUTCDay() + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

function getLastWeekdayOfMonth(year: number, month: number, weekday: number) {
  const lastOfMonth = new Date(Date.UTC(year, month + 1, 0));
  const offset = (lastOfMonth.getUTCDay() - weekday + 7) % 7;
  return lastOfMonth.getUTCDate() - offset;
}
