import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { ResourceTable } from "@/components/app/resource-table";
import { TablePageLayout } from "@/components/app/table-page-layout";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getPaginatedRows } from "@/lib/data-table";
import { formatHllPresetLabel } from "@/lib/hll-map-presets";
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
    title: `${server?.name ?? "Clan"} ${dictionary.presets.topicTitle}`,
    description: dictionary.presets.topicPresetMetaDescription,
  };
}

export default async function TopicPresetsPage({
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
  const { topicPresets, canAdmin } = context;
  const paginated = getPaginatedRows({
    rows: topicPresets,
    searchParams: resolvedSearchParams,
    getSearchText: (preset) => [preset.name, preset.map, preset.side, ...preset.topics.map((topic) => topic.title)].filter(Boolean).join(" "),
  });

  return (
    <TablePageLayout
        header={
          <PageHeader
            title={dictionary.presets.topicTitle}
            description={dictionary.presets.topicDescription}
            actions={canAdmin ? <Button asChild className="rounded-xl"><a href={`/${locale}/dashboard/servers/${serverId}/topic-presets/create`}>{dictionary.common.createPreset}</a></Button> : undefined}
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
          getHref={(preset) => `/${locale}/dashboard/servers/${serverId}/topic-presets/${preset.id}`}
          columns={[
            { key: "name", title: dictionary.presets.table.preset, render: (preset) => <div className="font-medium">{preset.name}</div> },
            { key: "map", title: dictionary.calendarCards.map, render: (preset) => `${formatHllPresetLabel(preset.map) ?? preset.map ?? "TBD"} • ${preset.side ?? "TBD"}` },
            { key: "topics", title: dictionary.presets.table.topics, render: (preset) => preset.topics.length },
          ]}
        />
      </TablePageLayout>
  );
}
