import type { Metadata } from "next";

import { EventFormPanel } from "@/components/app/event-form-panel";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; serverId: string; eventId: string }>;
}): Promise<Metadata> {
  const { serverId, eventId } = await params;
  const context = await getServerContext(serverId);
  const event = context?.events.find((item) => item.id === eventId);
  return {
    title: event?.name ?? "Event",
    description: event?.description,
  };
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

  return (
    <>
      <PageHeader
        title={event.name}
        description={event.description}
        badge={event.cap}
        actions={
          roster?.published ? (
            <Button asChild variant="outline" className="rounded-xl">
              <a href={`/${locale}/dashboard/servers/${serverId}/rosters/${roster.id}`}>{dictionary.event.showRoster}</a>
            </Button>
          ) : undefined
        }
      />
      <div className="px-4 lg:px-6">
        <EventFormPanel event={event} serverId={serverId} locale={locale} topicPresets={topicPresets} timezone={discordConfig?.timezone ?? "UTC"} canEdit={canAdmin} dictionary={dictionary} createMode={false} />
      </div>
    </>
  );
}
