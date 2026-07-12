import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { ResourceTable } from "@/components/app/resource-table";
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
    title: `${server?.name ?? "Clan"} ${dictionary.presets.squadTitle}`,
    description: dictionary.presets.squadPresetMetaDescription,
  };
}

export default async function SquadPresetsPage({
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
  const { squadPresets, canAdmin } = context;
  const paginated = getPaginatedRows({
    rows: squadPresets,
    searchParams: resolvedSearchParams,
    getSearchText: (preset) => [preset.name, ...preset.squads.map((squad) => squad.name)].join(" "),
  });

  return (
    <TablePageLayout
        header={
          <PageHeader
            title={dictionary.presets.squadTitle}
            description={dictionary.presets.squadDescription}
            actions={canAdmin ? <Button asChild className="rounded-xl"><a href={`/${locale}/dashboard/servers/${serverId}/squad-presets/create`}>{dictionary.common.createPreset}</a></Button> : undefined}
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
          getHref={(preset) => `/${locale}/dashboard/servers/${serverId}/squad-presets/${preset.id}`}
          columns={[
            { key: "name", title: dictionary.presets.table.preset, render: (preset) => <div className="font-medium">{preset.name}</div> },
            { key: "groups", title: dictionary.presets.table.groups, render: (preset) => preset.squads.length },
            {
              key: "roles",
              title: dictionary.presets.table.roleSlots,
              render: (preset) =>
                preset.squads.reduce((sum, squad) => sum + squad.roles.reduce((roleSum, role) => roleSum + role.count, 0), 0),
            },
          ]}
        />
      </TablePageLayout>
  );
}
