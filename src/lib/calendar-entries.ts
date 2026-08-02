import { expandCalendarItems } from "@/lib/calendar-items";
import { getEventCategoryPresentation } from "@/lib/event-categories";
import type { CalendarItem, EventCategory, EventRecord } from "@/types/domain";

export type CalendarDisplayEntry =
  | {
      id: string;
      kind: "event";
      title: string;
      description?: string;
      startAt: string;
      endAt: string;
      allDay: false;
      color: string;
      emoji?: string;
      label?: string;
      event: EventRecord;
    }
  | {
      id: string;
      kind: "manual";
      title: string;
      description?: string;
      startAt: string;
      endAt: string;
      allDay: boolean;
      color: string;
      emoji?: string;
      label?: string;
      item: CalendarItem;
    };

export function buildCalendarDisplayEntries(input: {
  events: EventRecord[];
  eventCategories?: EventCategory[];
  calendarItems?: CalendarItem[];
  rangeStart: Date;
  rangeEnd: Date;
}) {
  const eventEntries: CalendarDisplayEntry[] = input.events
    .filter((event) => {
      const eventStart = new Date(event.meetingStart).getTime();
      const eventEnd = new Date(event.gameEnd).getTime();
      return eventEnd >= input.rangeStart.getTime() && eventStart <= input.rangeEnd.getTime();
    })
    .map((event) => {
      const category = getEventCategoryPresentation(event, input.eventCategories);
      return {
        id: event.id,
        kind: "event",
        title: event.name,
        description: event.description,
        startAt: event.meetingStart,
        endAt: event.gameEnd,
        allDay: false,
        color: category.color,
        emoji: category.emoji,
        label: category.label,
        event,
      } satisfies CalendarDisplayEntry;
    });

  const manualEntries: CalendarDisplayEntry[] = expandCalendarItems(
    input.calendarItems ?? [],
    input.rangeStart,
    input.rangeEnd,
  ).map((item) => ({
    id: item.id,
    kind: "manual",
    title: item.title,
    description: item.description,
    startAt: item.startAt,
    endAt: item.endAt,
    allDay: item.allDay,
    color: item.color,
    emoji: item.emoji,
    label: item.label,
    item: (input.calendarItems ?? []).find((source) => source.id === item.sourceId)!,
  }));

  return [...eventEntries, ...manualEntries]
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime());
}
