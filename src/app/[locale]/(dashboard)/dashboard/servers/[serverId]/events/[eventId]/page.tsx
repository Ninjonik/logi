import type { Metadata } from "next";

import { ConcludeEventButton } from "@/components/app/conclude-event-button";
import { EventFormPanel } from "@/components/app/event-form-panel";
import { PageHeader } from "@/components/app/page-header";
import { SubmitMatchResultsButton } from "@/components/app/submit-match-results-button";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getEventStatusMeta } from "@/lib/event-status";
import { getEventMetadata } from "@/lib/server-metadata";
import { getServerContext } from "@/lib/server-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; serverId: string; eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  const event = await getEventMetadata(eventId);
  return {
    title: event?.name ?? "Event",
    description: event?.description,
  };
}

export function generateStaticParams() {
  return [{ eventId: "sample-event" }];
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string; eventId: string }>;
}) {
  const { locale, serverId, eventId } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const context = await getServerContext(serverId);
  if (!context) return null;
  const { events, rosters, canAdmin, topicPresets, discordConfig } = context;
  const event = events.find((item) => item.id === eventId);
  const roster = rosters.find((item) => item.eventId === eventId);

  if (!event) return null;

  const statusMeta = getEventStatusMeta(event.status, dictionary);

  return (
    <>
      <PageHeader
        title={event.name}
        description={event.description}
        badge={`${event.cap ? `${event.cap} • ` : ""}${statusMeta?.label}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {roster?.published ? (
              <Button asChild variant="outline" className="rounded-xl">
                <a href={`/${locale}/dashboard/servers/${serverId}/rosters/${roster.id}`}>{dictionary.event.showRoster}</a>
              </Button>
            ) : null}
            {event.matchId ? (
              <Button asChild variant="outline" className="rounded-xl">
                <a href={`/${locale}/dashboard/servers/${serverId}/events/${event.id}/match`}>{dictionary.event.openMatch}</a>
              </Button>
            ) : null}
            {canAdmin ? (
              event.status === "concluded" ? (
                <SubmitMatchResultsButton
                  serverId={serverId}
                  eventId={event.id}
                  dictionary={dictionary}
                />
              ) : (
                <ConcludeEventButton
                  serverId={serverId}
                  eventId={event.id}
                  disabled={false}
                  dictionary={dictionary}
                />
              )
            ) : null}
          </div>
        }
      />
      <div className="px-4 lg:px-6">
        <EventFormPanel event={event} serverId={serverId} locale={locale} topicPresets={topicPresets} timezone={discordConfig?.timezone ?? "UTC"} canEdit={canAdmin} dictionary={dictionary} createMode={false} discordConfig={discordConfig} />
      </div>
    </>
  );
}
