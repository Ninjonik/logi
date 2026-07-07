"use client";

import Link from "next/link";
import { MonthCalendarView } from "@/components/app/month-calendar-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dictionary } from "@/i18n/dictionaries";
import type { EventRecord, Roster } from "@/types/domain";
import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/lib/format";

export function CalendarView({
  locale,
  serverId,
  events,
  rosters,
  timezone,
  dictionary,
}: {
  locale: Locale;
  serverId: string;
  events: EventRecord[];
  rosters: Roster[];
  timezone?: string;
  dictionary: Dictionary;
}) {
  const highlightedEvents = [...events]
    .sort((a, b) => new Date(a.meetingStart).getTime() - new Date(b.meetingStart).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <MonthCalendarView locale={locale} serverId={serverId} events={events} timezone={timezone} dictionary={dictionary} />
      <div className="grid gap-4 xl:grid-cols-3">
        {highlightedEvents.map((event) => {
          const roster = rosters.find((item) => item.eventId === event.id);

          return (
            <Card key={event.id} className="rounded-2xl border-border/60">
              <CardHeader>
                <CardTitle className="text-xl">{event.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{event.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <InfoTile label={dictionary.calendarCards.registrationEnds} value={formatDateTime(event.registrationEnd, timezone)} />
                  <InfoTile label={dictionary.calendarCards.meeting} value={formatDateTime(event.meetingStart, timezone)} />
                  <InfoTile label={dictionary.calendarCards.map} value={`${event.map ?? "TBD"} • ${event.side ?? "TBD"}`} />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild className="rounded-xl">
                    <Link href={`/${locale}/dashboard/servers/${serverId}/events/${event.id}`}>{dictionary.common.viewDetails}</Link>
                  </Button>
                  {roster?.published ? (
                    <Button asChild variant="outline" className="rounded-xl">
                      <Link href={`/${locale}/dashboard/servers/${serverId}/rosters/${roster.id}`}>{dictionary.calendarCards.showRoster}</Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
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
