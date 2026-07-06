import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { ResourceTable, StatusBadge } from "@/components/app/resource-table";
import { Button } from "@/components/ui/button";
import { getServerContext } from "@/lib/server-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string }>;
}): Promise<Metadata> {
  const { serverId } = await params;
  const context = getServerContext(serverId);
  return {
    title: `${context.server?.name ?? "Server"} rosters`,
    description: "Rosters seeded from squad presets and published when ready.",
  };
}

export default async function RostersPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const { rosters, events, canAdmin } = getServerContext(serverId);

  return (
    <>
      <PageHeader
        title="Rosters"
        description="Rosters stay hidden from regular members until they are published, then players can acknowledge their slot."
        actions={canAdmin ? <Button asChild className="rounded-xl"><a href={`/${locale}/dashboard/servers/${serverId}/rosters/create`}>Create roster</a></Button> : undefined}
      />
      <div className="px-4 lg:px-6">
        <ResourceTable
          rows={rosters}
          getHref={(roster) => `/${locale}/dashboard/servers/${serverId}/rosters/${roster.id}`}
          columns={[
            {
              key: "event",
              title: "Event",
              render: (roster) => events.find((event) => event.id === roster.eventId)?.name ?? "Unassigned",
            },
            { key: "squads", title: "Squads", render: (roster) => roster.squads.length },
            { key: "reserves", title: "Reserves", render: (roster) => roster.reservePlayerIds.length },
            {
              key: "published",
              title: "Visibility",
              render: (roster) => (
                <StatusBadge active={roster.published} activeLabel="Published" inactiveLabel="Hidden" />
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
