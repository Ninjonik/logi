"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { CalendarEntryDialog } from "@/components/app/calendar-entry-dialog";
import { EmojiValue } from "@/components/app/emoji-value";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { CalendarDisplayEntry } from "@/lib/calendar-entries";
import { formatDateKey, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Group } from "@/types/domain";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthCalendarView({
  locale,
  serverId,
  entries,
  groups,
  timezone,
  dictionary,
  signupLanguage,
}: {
  locale: Locale;
  serverId: string;
  entries: CalendarDisplayEntry[];
  groups: Group[];
  timezone?: string;
  dictionary: Dictionary;
  signupLanguage: "en" | "cs";
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (entries[0]) return startOfMonth(parseISO(entries[0].startAt));
    return startOfMonth(new Date());
  });

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const entriesByDate = useMemo(() => {
    const grouped = new Map<string, CalendarDisplayEntry[]>();
    for (const entry of entries) {
      const key = formatDateKey(entry.startAt, timezone);
      grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    }
    return grouped;
  }, [entries, timezone]);

  return (
    <Card className="overflow-hidden rounded-2xl border-border/60">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-4">
        <div>
          <div className="text-xl font-semibold">{format(currentMonth, "MMMM yyyy")}</div>
          <div className="text-sm text-muted-foreground">{dictionary.calendarPage.monthView}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setCurrentMonth((value) => subMonths(value, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => setCurrentMonth(startOfMonth(new Date()))}>
            {dictionary.common.today}
          </Button>
          <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setCurrentMonth((value) => addMonths(value, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b border-border/60">
          {weekdays.map((day) => (
            <div key={day} className="border-r border-border/60 px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {monthDays.map((day) => {
            const key = formatDateKey(day.toISOString(), timezone);
            const dayEntries = entriesByDate.get(key) ?? [];

            return (
              <div
                key={key}
                className={cn(
                  "min-h-44 border-r border-b border-border/60 p-2 last:border-r-0",
                  !isSameMonth(day, currentMonth) && "bg-muted/20",
                  isToday(day) && "bg-primary/5",
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex size-8 items-center justify-center rounded-full text-sm",
                      isToday(day) && "bg-primary text-primary-foreground",
                      !isSameMonth(day, currentMonth) && "text-muted-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {dayEntries.length ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {dayEntries.length}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-2">
                  {dayEntries.slice(0, 4).map((entry) => (
                    <CalendarEntryDialog
                      key={entry.id}
                      locale={locale}
                      serverId={serverId}
                      entry={entry}
                      groups={groups}
                      timezone={timezone}
                      dictionary={dictionary}
                      signupLanguage={signupLanguage}
                      trigger={(
                        <button
                          type="button"
                          className="block w-full rounded-xl border bg-card px-2.5 py-2 text-left transition hover:bg-primary/5"
                          style={{ borderColor: `${entry.color}66`, boxShadow: `inset 3px 0 0 ${entry.color}` }}
                        >
                          <div className="truncate text-xs font-semibold">
                            <span className="inline-flex items-center gap-1.5">
                              <EmojiValue value={entry.emoji} />
                              <span className="truncate">{entry.title}</span>
                            </span>
                          </div>
                          <div className="mt-1 truncate text-[11px] text-muted-foreground">
                            {entry.allDay ? dictionary.calendarPage.allDay : formatTime(entry.startAt, timezone)}
                            {entry.label ? ` • ${entry.label}` : ""}
                          </div>
                        </button>
                      )}
                    />
                  ))}
                  {dayEntries.length > 4 ? (
                    <div className="px-1 text-[11px] text-muted-foreground">
                      +{dayEntries.length - 4} {dictionary.calendarPage.moreEvents}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
