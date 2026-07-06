import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { ResourceTable, StatusBadge } from "@/components/app/resource-table";
import { Button } from "@/components/ui/button";
import { getServerContext } from "@/lib/server-context";
import { formatDateTime } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string }>;
}): Promise<Metadata> {
  const { serverId } = await params;
  const context = getServerContext(serverId);
  return {
    title: `${context.server?.name ?? "Server"} events`,
    description: "Admin event list with create and edit flows prepared.",
  };
}

export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const { events, canAdmin } = getServerContext(serverId);

  return (
    <>
      <PageHeader
        title="Events"
        description="Admins can create events, open any event page, and switch those pages into edit mode later."
        actions={canAdmin ? <Button asChild className="rounded-xl"><a href={`/${locale}/dashboard/servers/${serverId}/events/create`}>Create event</a></Button> : undefined}
      />
      <div className="px-4 lg:px-6">
        <ResourceTable
          rows={events}
          getHref={(event) => `/${locale}/dashboard/servers/${serverId}/events/${event.id}`}
          columns={[
            { key: "name", title: "Event", render: (event) => <div className="font-medium">{event.name}</div> },
            { key: "meetingStart", title: "Meeting", render: (event) => formatDateTime(event.meetingStart) },
            { key: "map", title: "Map", render: (event) => `${event.map ?? "TBD"} • ${event.side ?? "TBD"}` },
            {
              key: "pingClan",
              title: "Ping clan",
              render: (event) => (
                <StatusBadge active={event.pingClan} activeLabel="Enabled" inactiveLabel="Disabled" />
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
