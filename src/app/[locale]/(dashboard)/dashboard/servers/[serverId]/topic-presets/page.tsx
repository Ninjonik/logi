import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { ResourceTable } from "@/components/app/resource-table";
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
    title: `${context.server?.name ?? "Server"} topic presets`,
    description: "Reusable briefing templates copied into events when needed.",
  };
}

export default async function TopicPresetsPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const { topicPresets, canAdmin } = getServerContext(serverId);

  return (
    <>
      <PageHeader
        title="Topic presets"
        description="Preset briefings are reference data. Events can copy them so later preset changes do not rewrite old matches."
        actions={canAdmin ? <Button asChild className="rounded-xl"><a href={`/${locale}/dashboard/servers/${serverId}/topic-presets/create`}>Create preset</a></Button> : undefined}
      />
      <div className="px-4 lg:px-6">
        <ResourceTable
          rows={topicPresets}
          getHref={(preset) => `/${locale}/dashboard/servers/${serverId}/topic-presets/${preset.id}`}
          columns={[
            { key: "name", title: "Preset", render: (preset) => <div className="font-medium">{preset.name}</div> },
            { key: "map", title: "Map", render: (preset) => `${preset.map ?? "TBD"} • ${preset.side ?? "TBD"}` },
            { key: "topics", title: "Topics", render: (preset) => preset.topics.length },
          ]}
        />
      </div>
    </>
  );
}
