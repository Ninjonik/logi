import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { ResourceTable } from "@/components/app/resource-table";
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
  const context = getServerContext(serverId);
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  return {
    title: `${context.server?.name ?? "Clan"} ${dictionary.presets.topicTitle}`,
    description: dictionary.presets.topicPresetMetaDescription,
  };
}

export default async function TopicPresetsPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const { topicPresets, canAdmin } = getServerContext(serverId);

  return (
    <>
      <PageHeader
        title={dictionary.presets.topicTitle}
        description={dictionary.presets.topicDescription}
        actions={canAdmin ? <Button asChild className="rounded-xl"><a href={`/${locale}/dashboard/servers/${serverId}/topic-presets/create`}>{dictionary.common.createPreset}</a></Button> : undefined}
      />
      <div className="px-4 lg:px-6">
        <ResourceTable
          dictionary={dictionary}
          rows={topicPresets}
          getHref={(preset) => `/${locale}/dashboard/servers/${serverId}/topic-presets/${preset.id}`}
          columns={[
            { key: "name", title: dictionary.presets.table.preset, render: (preset) => <div className="font-medium">{preset.name}</div> },
            { key: "map", title: dictionary.calendarCards.map, render: (preset) => `${preset.map ?? "TBD"} • ${preset.side ?? "TBD"}` },
            { key: "topics", title: dictionary.presets.table.topics, render: (preset) => preset.topics.length },
          ]}
        />
      </div>
    </>
  );
}
