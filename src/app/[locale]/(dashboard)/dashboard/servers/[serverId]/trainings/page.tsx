import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { ResourceTable, StatusBadge } from "@/components/app/resource-table";
import { TablePageLayout } from "@/components/app/table-page-layout";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getPaginatedRows } from "@/lib/data-table";
import { getEventStatusMeta } from "@/lib/event-status";
import { formatDateTime } from "@/lib/format";
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
    title: `${server?.name ?? "Clan"} ${dictionary.sidebar.trainings ?? "Trainings"}`,
    description: dictionary.event.listDescription,
  };
}

export default async function TrainingsPage({
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
  const { events, canAdmin, discordConfig } = context;
  const trainings = events.filter((event) => event.kind === "training");
  const paginated = getPaginatedRows({
    rows: trainings,
    searchParams: resolvedSearchParams,
    getSearchText: (event) => [event.name, event.description, event.status].filter(Boolean).join(" "),
  });

  return (
    <TablePageLayout
      header={(
        <PageHeader
          title={dictionary.sidebar.trainings ?? "Trainings"}
          description={dictionary.event.listDescription}
          actions={canAdmin ? (
            <Button asChild className="rounded-xl">
              <a href={`/${locale}/dashboard/servers/${serverId}/trainings/create`}>{dictionary.common.createEvent}</a>
            </Button>
          ) : undefined}
        />
      )}
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
        getHref={(event) => `/${locale}/dashboard/servers/${serverId}/trainings/${event.id}`}
        columns={[
          { key: "name", title: dictionary.tables.event, render: (event) => <div className="font-medium">{event.name}</div> },
          { key: "meetingStart", title: dictionary.tables.meeting, render: (event) => formatDateTime(event.meetingStart, discordConfig?.timezone) },
          { key: "meetingChannelId", title: dictionary.event.fields.meetingChannelId ?? "Meeting VC", render: (event) => event.meetingChannelId ?? dictionary.shared.notSet },
          {
            key: "status",
            title: dictionary.tables.status,
            render: (event) => {
              const meta = getEventStatusMeta(event.status, dictionary);
              return <StatusBadge active={meta?.active} activeLabel={meta.label} inactiveLabel={meta.label} />;
            },
          },
        ]}
      />
    </TablePageLayout>
  );
}
