import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { ResourceTable, StatusBadge } from "@/components/app/resource-table";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";
import { formatDateTime } from "@/lib/format";
import { getEventStatusMeta } from "@/lib/event-status";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string; locale: string }>;
}): Promise<Metadata> {
  const { serverId, locale } = await params;
  const context = await getServerContext(serverId);
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  return {
    title: `${context?.server?.name ?? "Clan"} ${dictionary.sidebar.events}`,
    description: dictionary.event.createDescription,
  };
}

export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const context = await getServerContext(serverId);
  if (!context) return null;
  const { events, canAdmin, discordConfig } = context;

  return (
    <>
      <PageHeader
        title={dictionary.sidebar.events}
        description={dictionary.event.infoDescription}
        actions={canAdmin ? <Button asChild className="rounded-xl"><a href={`/${locale}/dashboard/servers/${serverId}/events/create`}>{dictionary.common.createEvent}</a></Button> : undefined}
      />
      <div className="px-4 lg:px-6">
        <ResourceTable
          dictionary={dictionary}
          rows={events}
          getHref={(event) => `/${locale}/dashboard/servers/${serverId}/events/${event.id}`}
          columns={[
            { key: "name", title: dictionary.tables.event, render: (event) => <div className="font-medium">{event.name}</div> },
            { key: "meetingStart", title: dictionary.tables.meeting, render: (event) => formatDateTime(event.meetingStart, discordConfig?.timezone) },
            { key: "map", title: dictionary.calendarCards.map, render: (event) => `${event.map ?? "TBD"} • ${event.side ?? "TBD"}` },
            {
              key: "status",
              title: dictionary.tables.status,
              render: (event) => {
                const meta = getEventStatusMeta(event.status, dictionary);
                return <StatusBadge active={meta?.active} activeLabel={meta.label} inactiveLabel={meta.label} />;
              },
            },
            {
              key: "pingClan",
              title: dictionary.event.fields.pingClan,
              render: (event) => (
                <StatusBadge active={event.pingClan} activeLabel={dictionary.tables.enabled} inactiveLabel={dictionary.tables.disabled} />
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
