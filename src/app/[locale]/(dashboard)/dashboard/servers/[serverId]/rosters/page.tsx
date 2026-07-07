import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { ResourceTable, StatusBadge } from "@/components/app/resource-table";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string; locale: string }>;
}): Promise<Metadata> {
  const { serverId, locale } = await params;
  const context = await getServerContext(serverId);
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  return {
    title: `${context?.server?.name ?? "Clan"} ${dictionary.sidebar.rosters}`,
    description: dictionary.roster.title,
  };
}

export default async function RostersPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const context = await getServerContext(serverId);
  if (!context) return null;
  const { rosters, events, canAdmin } = context;

  return (
    <>
      <PageHeader
        title={dictionary.sidebar.rosters}
        actions={canAdmin ? <Button asChild className="rounded-xl"><a href={`/${locale}/dashboard/servers/${serverId}/rosters/create`}>{dictionary.common.createRoster}</a></Button> : undefined}
      />
      <div className="px-4 lg:px-6">
        <ResourceTable
          dictionary={dictionary}
          rows={rosters}
          getHref={(roster) => `/${locale}/dashboard/servers/${serverId}/rosters/${roster.id}`}
          columns={[
            {
              key: "event",
              title: dictionary.tables.event,
              render: (roster) => events.find((event) => event.id === roster.eventId)?.name ?? dictionary.tables.unassigned,
            },
            { key: "squads", title: dictionary.tables.squads, render: (roster) => roster.squads.length },
            { key: "reserves", title: dictionary.tables.reserves, render: (roster) => roster.reservePlayerIds.length },
            {
              key: "published",
              title: dictionary.tables.visibility,
              render: (roster) => (
                <StatusBadge active={roster.published} activeLabel={dictionary.common.published} inactiveLabel={dictionary.tables.hidden} />
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
