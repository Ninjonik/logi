"use client";

import Link from "next/link";
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

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import type { EventCategory, EventRecord } from "@/types/domain";
import { formatDateKey, formatDateTime, formatTime } from "@/lib/format";
import { formatHllPresetLabel } from "@/lib/hll-map-presets";
import { getEventCategoryPresentation } from "@/lib/event-categories";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthCalendarView({
  locale,
  serverId,
  events,
  eventCategories = [],
  timezone,
  dictionary,
}: {
  locale: Locale;
  serverId: string;
  events: EventRecord[];
  eventCategories?: EventCategory[];
  timezone?: string;
  dictionary: Dictionary;
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (events[0]) return startOfMonth(parseISO(events[0].meetingStart));
    return startOfMonth(new Date());
  });
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, EventRecord[]>();
    for (const event of events) {
      const key = formatDateKey(event.meetingStart, timezone);
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    }
    return grouped;
  }, [events, timezone]);

  const selectedCategory = selectedEvent
    ? getEventCategoryPresentation(selectedEvent, eventCategories)
    : null;

  return (
    <>
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
              const dayEvents = eventsByDate.get(key) ?? [];

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
                    {dayEvents.length ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        {dayEvents.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {dayEvents.slice(0, 4).map((event) => {
                      const category = getEventCategoryPresentation(event, eventCategories);

                      return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => setSelectedEvent(event)}
                          className="block w-full rounded-xl border bg-card px-2.5 py-2 text-left transition hover:bg-primary/5"
                          style={{ borderColor: `${category.color}66`, boxShadow: `inset 3px 0 0 ${category.color}` }}
                        >
                          <div className="truncate text-xs font-semibold">
                            {[category.emoji, event.name].filter(Boolean).join(" ")}
                          </div>
                          <div className="mt-1 truncate text-[11px] text-muted-foreground">
                            {formatTime(event.meetingStart, timezone)}
                            {category.label ? ` • ${category.label}` : ""}
                          </div>
                        </button>
                      );
                    })}
                    {dayEvents.length > 4 ? (
                      <div className="px-1 text-[11px] text-muted-foreground">
                        +{dayEvents.length - 4} {dictionary.calendarPage.moreEvents}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl rounded-2xl">
          {selectedEvent ? (
            <>
              <DialogHeader className="pr-12">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    {selectedCategory?.label ? (
                      <div
                        className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
                        style={{ borderColor: `${selectedCategory.color}66`, backgroundColor: `${selectedCategory.color}14`, color: selectedCategory.color }}
                      >
                        <span>{[selectedCategory.emoji, selectedCategory.label].filter(Boolean).join(" ")}</span>
                      </div>
                    ) : null}
                    <DialogTitle>{selectedEvent.name}</DialogTitle>
                    <DialogDescription>{selectedEvent.description || dictionary.event.listDescription}</DialogDescription>
                  </div>
                  <Button asChild className="rounded-xl">
                    <Link href={`/${locale}/dashboard/servers/${serverId}/${selectedEvent.kind === "training" ? "trainings" : "matches"}/${selectedEvent.id}`}>
                      {dictionary.common.viewDetails}
                    </Link>
                  </Button>
                </div>
              </DialogHeader>

              <div className="grid gap-3 md:grid-cols-2">
                <InfoTile label={dictionary.calendarCards.meeting} value={formatDateTime(selectedEvent.meetingStart, timezone)} />
                <InfoTile label={dictionary.calendarCards.registrationEnds} value={formatDateTime(selectedEvent.registrationEnd, timezone)} />
                <InfoTile label={dictionary.calendarCards.gameStart} value={formatDateTime(selectedEvent.gameStart, timezone)} />
                <InfoTile
                  label={dictionary.calendarCards.map}
                  value={selectedEvent.kind === "training"
                    ? (selectedEvent.meetingChannelId || "Discord")
                    : `${formatHllPresetLabel(selectedEvent.map) ?? selectedEvent.map ?? "TBD"} • ${selectedEvent.side ?? "TBD"}`}
                />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-semibold">{value}</div>
    </div>
  );
}
