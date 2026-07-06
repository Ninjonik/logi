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
  const event = getServerContext(serverId).events.find((item) => item.id === eventId);
  return {
    title: event?.name ?? "Event details",
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
  const { events, rosters, canAdmin } = getServerContext(serverId);
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
              <a href={`/${locale}/dashboard/servers/${serverId}/rosters/${roster.id}`}>Show roster</a>
            </Button>
          ) : undefined
        }
      />
      <div className="px-4 lg:px-6">
        <EventFormPanel event={event} canEdit={canAdmin} dictionary={dictionary} />
      </div>
    </>
  );
}
