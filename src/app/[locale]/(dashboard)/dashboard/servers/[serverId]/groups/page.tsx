import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { ResourceTable } from "@/components/app/resource-table";
import { TablePageLayout } from "@/components/app/table-page-layout";
import { Badge } from "@/components/ui/badge";
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
    title: `${server?.name ?? "Clan"} ${dictionary.sidebar.groups}`,
    description: dictionary.groups.description,
  };
}

export default async function GroupsPage({
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

  const { groups = [], assignments = [], canAdmin } = context;
  const paginated = getPaginatedRows({
    rows: groups,
    searchParams: resolvedSearchParams,
    getSearchText: (group) => [group.name, group.description, group.color].filter(Boolean).join(" "),
  });

  return (
    <TablePageLayout
        header={
          <PageHeader
            title={dictionary.sidebar.groups}
            description={dictionary.groups.description}
            actions={
              canAdmin ? (
                <Button asChild className="rounded-xl">
                  <a href={`/${locale}/dashboard/servers/${serverId}/groups/create`}>{dictionary.groups.createTitle}</a>
                </Button>
              ) : undefined
            }
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
          getHref={(group) => `/${locale}/dashboard/servers/${serverId}/groups/${group.id}`}
          columns={[
            {
              key: "name",
              title: dictionary.groups.name,
              render: (group) => (
                <div className="flex items-center gap-3">
                  <span className="size-3 rounded-full border border-border/60" style={{ backgroundColor: group.color }} />
                  <div className="font-medium">{group.name}</div>
                </div>
              ),
            },
            {
              key: "usage",
              title: dictionary.groups.usedByPlayers,
              render: (group) => assignments.filter((assignment) => assignment.primaryGroupId === group.id).length,
            },
            {
              key: "description",
              title: dictionary.groups.descriptionLabel,
              render: (group) => group.description ? <span>{group.description}</span> : <Badge variant="secondary">{dictionary.shared.notSet}</Badge>,
            },
          ]}
        />
      </TablePageLayout>
  );
}
