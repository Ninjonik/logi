import type { Metadata } from "next";
import { CalendarDays, ClipboardList, ListTodo, Radio, Users } from "lucide-react";
import { addDays, format } from "date-fns";

import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { EventCalendarEventDialog } from "@/components/app/event-calendar-event-dialog";
import { EmojiValue } from "@/components/app/emoji-value";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/i18n/dictionaries";
import { type Locale, isLocale } from "@/i18n/config";
import { getEventCategoryPresentation } from "@/lib/event-categories";
import { formatDateKey, formatTime } from "@/lib/format";
import { getGuildMetadata } from "@/lib/server-metadata";
import { getServerContext } from "@/lib/server-context";
import { getLoggedInUser } from "@/lib/auth"

export const metadata: Metadata = {
  title: "Server dashboard | Logi",
  description: "Manage your server community.",
};

function getGreeting(dictionary: ReturnType<typeof getDictionary>, timezone?: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );

  if (hour < 12) return dictionary.dashboard.greetingMorning;
  if (hour < 18) return dictionary.dashboard.greetingAfternoon;
  return dictionary.dashboard.greetingEvening;
}

function getWeekDays(timezone?: string) {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(today, index);
    return {
      date: day,
      key: formatDateKey(day.toISOString(), timezone),
    };
  });
}

export default async function ServerOverviewPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const safeLocale = (isLocale(locale) ? locale : "en") as Locale;
  const dictionary = getDictionary(safeLocale);
  const context = await getServerContext(serverId);
  if (!context) return null;
  const {
    server,
    events,
    rosters,
    canAdmin,
    assignments = [],
    groups = [],
    squadPresets = [],
    topicPresets = [],
    discordConfig,
  } = context;

  const user = await getLoggedInUser();

  const publishedRosters = rosters.filter((roster) => roster.published);
  const greeting = getGreeting(dictionary, discordConfig?.timezone);
  const weekDays = getWeekDays(discordConfig?.timezone);
  const eventsByDate = new Map<string, typeof events>();
  for (const event of events) {
    const key = formatDateKey(event.meetingStart, discordConfig?.timezone);
    eventsByDate.set(key, [...(eventsByDate.get(key) ?? []), event]);
  }
  const nextEvent = [...events]
    .filter((event) => new Date(event.meetingStart).getTime() >= Date.now())
    .sort((a, b) => new Date(a.meetingStart).getTime() - new Date(b.meetingStart).getTime())[0];

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user?.name}`}
        description={server.description || dictionary.dashboard.description}
      />
      <div className="space-y-6 px-4 lg:px-6">
        <Card className="overflow-hidden rounded-2xl border-border/60 bg-[linear-gradient(135deg,rgba(90,110,55,.18),rgba(201,168,78,.08))]">
          <CardHeader>
            <CardTitle className="text-2xl">{dictionary.sidebar.workspace}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <div className="text-sm uppercase tracking-[0.22em] text-muted-foreground">{greeting}, {user?.name}</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight">{server.name}</div>
                <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                  {nextEvent
                    ? `${dictionary.clan.upcomingEvents}: ${nextEvent.name}`
                    : dictionary.calendarCards.noEvents}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {canAdmin ? (
                  <Button asChild className="rounded-xl">
                    <a href={`/${safeLocale}/dashboard/servers/${serverId}/events/create`}>
                      <ListTodo className="size-4" />
                      {dictionary.common.createEvent}
                    </a>
                  </Button>
                ) : null}
                {canAdmin ? (
                  <Button asChild variant="outline" className="rounded-xl">
                    <a href={`/${safeLocale}/dashboard/servers/${serverId}/rosters/create`}>
                      <Radio className="size-4" />
                      {dictionary.common.createRoster}
                    </a>
                  </Button>
                ) : null}
                <Button asChild variant="outline" className="rounded-xl">
                  <a href={`/${safeLocale}/dashboard/servers/${serverId}/calendar`}>
                    <CalendarDays className="size-4" />
                    {dictionary.sidebar.calendar}
                  </a>
                </Button>
                {canAdmin ? (
                  <Button asChild variant="ghost" className="rounded-xl">
                    <a href={`/${safeLocale}/dashboard/servers/${serverId}/events`}>
                      {dictionary.sidebar.events}
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <StatCard
                className="min-w-[220px] flex-1 lg:basis-0"
                title={dictionary.clan.upcomingEvents}
                value={events.length}
                description={nextEvent ? nextEvent.name : dictionary.common.notAvailable}
                icon={CalendarDays}
              />
              <StatCard
                className="min-w-[220px] flex-1 lg:basis-0"
                title={dictionary.clan.publishedRosters}
                value={publishedRosters.length}
                description={`${rosters.length} ${dictionary.sidebar.rosters.toLowerCase()}`}
                icon={Radio}
              />
              <StatCard
                className="min-w-[220px] flex-1 lg:basis-0"
                title={dictionary.clan.members}
                value={server.memberIds.length}
                description={`${assignments.length} ${dictionary.userManagement.title.toLowerCase()}`}
                icon={Users}
              />
              <StatCard
                className="min-w-[220px] flex-1 lg:basis-0"
                title={dictionary.clan.presets}
                value={groups.length + squadPresets.length + topicPresets.length}
                description={dictionary.sidebar.configuration}
                icon={ClipboardList}
              />
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden rounded-2xl border-border/60">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>{dictionary.calendarCards.eventCalendar}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Next 7 days</p>
            </div>
            <Button asChild variant="outline" className="rounded-xl">
              <a href={`/${safeLocale}/dashboard/servers/${serverId}/calendar`}>{dictionary.common.openAction}</a>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 lg:grid-cols-7">
              {weekDays.map((day) => {
                const dayEvents = eventsByDate.get(day.key) ?? [];

                return (
                  <div key={day.key} className="rounded-2xl border border-border/60 bg-card/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {format(day.date, "EEE")}
                        </div>
                        <div className="mt-1 text-lg font-semibold">
                          {format(day.date, "d MMM")}
                        </div>
                      </div>
                      <div className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        {dayEvents.length}
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {dayEvents.length ? (
                        dayEvents.slice(0, 3).map((event) => {
                          const category = getEventCategoryPresentation(event, server.eventCategories ?? []);

                          return (
                            <EventCalendarEventDialog
                              key={event.id}
                              locale={safeLocale}
                              serverId={serverId}
                              event={event}
                              groups={groups}
                              eventCategories={server.eventCategories ?? []}
                              timezone={discordConfig?.timezone}
                              dictionary={dictionary}
                              signupLanguage={discordConfig?.defaultLanguage ?? "en"}
                              trigger={(
                                <button
                                  type="button"
                                  className="block w-full rounded-xl border px-2.5 py-2 text-left transition hover:border-primary/40 hover:bg-primary/5"
                                  style={{ borderColor: `${category.color}66`, boxShadow: `inset 3px 0 0 ${category.color}` }}
                                >
                                  <div className="truncate text-sm font-medium">
                                    <span className="inline-flex items-center gap-1.5">
                                      <EmojiValue value={category.emoji} />
                                      <span className="truncate">{event.name}</span>
                                    </span>
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {formatTime(event.meetingStart, discordConfig?.timezone)}
                                    {category.label ? ` • ${category.label}` : ""}
                                  </div>
                                </button>
                              )}
                            />
                          );
                        })
                      ) : (
                        <div className="rounded-xl border border-dashed border-border/60 px-2.5 py-4 text-center text-xs text-muted-foreground">
                          {dictionary.calendarCards.noEvents}
                        </div>
                      )}
                      {dayEvents.length > 3 ? (
                        <div className="px-1 text-xs text-muted-foreground">
                          +{dayEvents.length - 3} {dictionary.calendarPage.moreEvents}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        {nextEvent ? (
          <Card className="rounded-2xl border-border/60">
            <CardHeader>
              {getEventCategoryPresentation(nextEvent, server.eventCategories ?? []).label ? (
                <Badge
                  variant="outline"
                  className="mb-2 rounded-full"
                  style={{
                    borderColor: `${getEventCategoryPresentation(nextEvent, server.eventCategories ?? []).color}66`,
                    color: getEventCategoryPresentation(nextEvent, server.eventCategories ?? []).color,
                    backgroundColor: `${getEventCategoryPresentation(nextEvent, server.eventCategories ?? []).color}14`,
                  }}
                >
                  <EmojiValue value={getEventCategoryPresentation(nextEvent, server.eventCategories ?? []).emoji} />
                  <span>{getEventCategoryPresentation(nextEvent, server.eventCategories ?? []).label}</span>
                </Badge>
              ) : null}
              <CardTitle>{nextEvent.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{nextEvent.description || dictionary.event.listDescription}</p>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button asChild className="rounded-xl">
                <a href={`/${safeLocale}/dashboard/servers/${serverId}/${nextEvent.kind === "training" ? "trainings" : "matches"}/${nextEvent.id}`}>{dictionary.common.viewDetails}</a>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <a href={`/${safeLocale}/dashboard/servers/${serverId}/rosters`}>
                  {dictionary.sidebar.rosters}
                </a>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
