type CalendarEvent = {
  name: string;
  matchType?: string;
  meetingStart: string;
  gameStart: string;
  gameEnd: string;
  status: string;
};

const calendarFields: Array<keyof CalendarEvent> = ["name", "matchType", "meetingStart", "gameStart", "gameEnd", "status"];

export function shouldRefreshCalendar(before: CalendarEvent, after: CalendarEvent) {
  return calendarFields.some((field) => before[field] !== after[field]);
}

export function shouldSyncEventRoles(before: Pick<CalendarEvent, "status">, after: Pick<CalendarEvent, "status">) {
  return before.status !== after.status;
}

export function getCalendarSyncVersion(event: CalendarEvent) {
  return calendarFields.map((field) => event[field] ?? "").join("|");
}
