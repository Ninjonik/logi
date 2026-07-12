import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { ResourceTable, StatusBadge } from "@/components/app/resource-table";
import { TablePageLayout } from "@/components/app/table-page-layout";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getPaginatedRows } from "@/lib/data-table";
import { getGuildMetadata } from "@/lib/server-metadata";
import { getServerContext } from "@/lib/server-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string; locale: string }>;
}): Promise<Metadata> {
  const { serverId, locale } = await params;
  const server = await getGuildMetadata(serverId);
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  return {
    title: `${server?.name ?? "Clan"} ${dictionary.sidebar.rosters}`,
    description: dictionary.roster.listDescription,
  };
}

export default async function RostersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; serverId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, serverId } = await params;
  const resolvedSearchParams = await searchParams;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const context = await getServerContext(serverId);
  if (!context) return null;
  const { rosters, events, canAdmin } = context;
  const paginated = getPaginatedRows({
    rows: rosters,
    searchParams: resolvedSearchParams,
    getSearchText: (roster) => {
      const eventName = events.find((event) => event.id === roster.eventId)?.name;
      return [eventName, roster.published ? dictionary.common.published : dictionary.tables.hidden].filter(Boolean).join(" ");
    },
  });

  return (
    <TablePageLayout
        header={
          <PageHeader
            title={dictionary.sidebar.rosters}
            description={dictionary.roster.listDescription}
            actions={canAdmin ? <Button asChild className="rounded-xl"><a href={`/${locale}/dashboard/servers/${serverId}/rosters/create`}>{dictionary.common.createRoster}</a></Button> : undefined}
          />
        }
      >
        <ResourceTable
          className="h-full"
          dictionary={dictionary}
          rows={paginated.rows}
          page={paginated.page}
          pageSize={paginated.pageSize}
          pageCount={paginated.pageCount}
          totalRows={paginated.totalRows}
          search={paginated.search}
          searchPlaceholder={dictionary.shared.searchTable}
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
      </TablePageLayout>
  );
}
