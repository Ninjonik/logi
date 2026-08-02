"use client";

import Link from "next/link";

import { EmojiValue } from "@/components/app/emoji-value";
import { MonthCalendarView } from "@/components/app/month-calendar-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { buildCalendarDisplayEntries } from "@/lib/calendar-entries";
import { formatDateTime } from "@/lib/format";
import { formatHllPresetLabel } from "@/lib/hll-map-presets";
import type { CalendarItem, EventCategory, EventRecord, Group, Roster } from "@/types/domain";

export function CalendarView({
  locale,
  serverId,
  events,
  calendarItems = [],
  groups,
  eventCategories = [],
  rosters,
  timezone,
  dictionary,
  signupLanguage,
}: {
  locale: Locale;
  serverId: string;
  events: EventRecord[];
  calendarItems?: CalendarItem[];
  groups: Group[];
  eventCategories?: EventCategory[];
  rosters: Roster[];
  timezone?: string;
  dictionary: Dictionary;
  signupLanguage: "en" | "cs";
}) {
  const now = new Date();
  const displayEntries = buildCalendarDisplayEntries({
    events,
    eventCategories,
    calendarItems,
    rangeStart: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
    rangeEnd: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
  });
  const highlightedEntries = displayEntries
    .filter((entry) => new Date(entry.endAt).getTime() >= now.getTime())
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <MonthCalendarView
        locale={locale}
        serverId={serverId}
        entries={displayEntries}
        groups={groups}
        timezone={timezone}
        dictionary={dictionary}
        signupLanguage={signupLanguage}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        {highlightedEntries.map((entry) => {
          const tertiaryValue = entry.kind === "event"
            ? (entry.event.kind === "training"
              ? (entry.event.meetingChannelId || "Discord")
              : `${formatHllPresetLabel(entry.event.map) ?? entry.event.map ?? "TBD"} • ${entry.event.side ?? "TBD"}`)
            : (entry.label ?? dictionary.shared.notSet);
          const roster = entry.kind === "event"
            ? rosters.find((item) => item.eventId === entry.event.id)
            : null;
          const detailPath = entry.kind === "event"
            ? `/${locale}/dashboard/servers/${serverId}/${entry.event.kind === "training" ? "trainings" : "matches"}/${entry.event.id}`
            : null;

          return (
            <Card key={entry.id} className="rounded-2xl border-border/60" style={{ boxShadow: `inset 4px 0 0 ${entry.color}` }}>
              <CardHeader>
                {entry.label ? (
                  <Badge
                    variant="outline"
                    className="mb-2 rounded-full"
                    style={{ borderColor: `${entry.color}66`, color: entry.color, backgroundColor: `${entry.color}14` }}
                  >
                    <EmojiValue value={entry.emoji} />
                    <span>{entry.label}</span>
                  </Badge>
                ) : null}
                <CardTitle className="text-xl">{entry.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{entry.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <InfoTile
                    label={dictionary.calendarCards.meeting}
                    value={entry.allDay ? dictionary.calendarPage.allDay : formatDateTime(entry.startAt, timezone)}
                  />
                  <InfoTile
                    label={dictionary.calendarCards.gameStart}
                    value={entry.allDay ? dictionary.calendarPage.allDay : formatDateTime(entry.endAt, timezone)}
                  />
                  <InfoTile label={dictionary.calendarCards.map} value={tertiaryValue} />
                </div>
                <div className="flex flex-wrap gap-3">
                  {detailPath ? (
                    <Button asChild className="rounded-xl">
                      <Link href={detailPath}>{dictionary.common.viewDetails}</Link>
                    </Button>
                  ) : null}
                  {entry.kind === "event" && entry.event.kind === "match" && roster?.published ? (
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
