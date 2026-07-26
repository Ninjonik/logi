import Link from "next/link";

import { PageHeader } from "@/components/app/page-header";
import { ResourceTable } from "@/components/app/resource-table";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getHllStratmapMapById, parseStratmapState } from "@/lib/stratmaps";
import { getServerContext } from "@/lib/server-context";

export default async function StratmapsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; serverId: string }>;
  searchParams?: Promise<{ search?: string; page?: string }>;
}) {
  const { locale, serverId } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const context = await getServerContext(serverId);
  if (!context) {
    return null;
  }

  const { search = "", page = "1" } = (await searchParams) ?? {};
  const normalizedSearch = search.trim().toLowerCase();
  const rows = context.stratmaps
    .filter((item) => !normalizedSearch || item.title.toLowerCase().includes(normalizedSearch) || item.baseMapId.includes(normalizedSearch))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return (
    <>
      <PageHeader
        title={dictionary.stratmaps.title}
        description={dictionary.stratmaps.pageDescription}
        actions={context.canAdmin ? (
          <Button asChild className="rounded-xl">
            <Link href={`/${locale}/dashboard/servers/${serverId}/stratmaps/create`}>{dictionary.stratmaps.createTitle}</Link>
          </Button>
        ) : undefined}
      />
      <div className="px-4 lg:px-6">
        <ResourceTable
          dictionary={dictionary}
          page={Number(page) || 1}
          pageSize={rows.length || 1}
          pageCount={1}
          totalRows={rows.length}
          search={search}
          searchPlaceholder={dictionary.stratmaps.searchPlaceholder}
          rows={rows}
          getHref={(row) => `/${locale}/dashboard/servers/${serverId}/stratmaps/${row.id}`}
          columns={[
            {
              key: "title",
              title: dictionary.stratmaps.tableTitle,
              render: (row) => row.title,
            },
            {
              key: "map",
              title: dictionary.stratmaps.tableMap,
              render: (row) => getHllStratmapMapById(row.baseMapId)?.name ?? row.baseMapId,
            },
            {
              key: "slides",
              title: dictionary.stratmaps.tableSlides,
              render: (row) => parseStratmapState(row.state, row.baseMapId).slides.length,
            },
            {
              key: "updated",
              title: dictionary.stratmaps.tableUpdated,
              render: (row) => new Date(row.updatedAt).toLocaleString(),
            },
          ]}
        />
      </div>
    </>
  );
}
