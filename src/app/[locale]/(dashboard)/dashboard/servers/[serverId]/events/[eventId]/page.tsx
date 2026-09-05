import type { Metadata } from "next";

import { ConcludeEventButton } from "@/components/app/conclude-event-button";
import { EventFormPanel } from "@/components/app/event-form-panel";
import { PageHeader } from "@/components/app/page-header";
import { SubmitMatchResultsButton } from "@/components/app/submit-match-results-button";
import { LinkCompetitionEvent } from "@/components/app/link-competition-event";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getEventStatusMeta } from "@/lib/event-status";
import { getEventMetadata } from "@/lib/server-metadata";
import { getServerContext } from "@/lib/server-context";
import { getPublicCompetition } from "@/lib/read-models/competitions";

export const metadata: Metadata = {
  title: "Event | Logi",
  description: "View and manage an event.",
};

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
  const { events, rosters, canAdmin, topicPresets, stratmaps, discordConfig, groups } = context;
  const event = events.find((item) => item.id === eventId);
  const roster = rosters.find((item) => item.eventId === eventId);
  const attachedStratmaps = stratmaps.filter((stratmap) => event?.stratmapIds.includes(stratmap.id));

  if (!event) return null;

  const statusMeta = getEventStatusMeta(event.status, dictionary);
  const competition = event.kind === "match" && canAdmin && !event.competitionFixtureId
    ? await getPublicCompetition("ecl-2026")
    : null;

  return (
    <>
      <PageHeader
        title={event.name}
        description={event.description}
        badge={`${event.cap ? `${event.cap} • ` : ""}${statusMeta?.label}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {attachedStratmaps.map((stratmap) => (
              <Button key={stratmap.id} asChild variant="outline" className="rounded-xl">
                <a href={`/${locale}/stratmaps/${stratmap.id}`}>{stratmap.title}</a>
              </Button>
            ))}
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
        <EventFormPanel event={event} serverId={serverId} locale={locale} topicPresets={topicPresets} stratmaps={stratmaps} groups={groups} eventCategories={context.server.eventCategories ?? []} timezone={discordConfig?.timezone ?? "UTC"} canEdit={canAdmin} dictionary={dictionary} createMode={false} discordConfig={discordConfig} />
        {competition ? <div className="mt-6"><LinkCompetitionEvent serverId={context.server.id} eventId={event.id} competition={competition} /></div> : null}
      </div>
    </>
  );
}
