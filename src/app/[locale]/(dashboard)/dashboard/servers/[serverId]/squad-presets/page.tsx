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
    title: `${context.server?.name ?? "Server"} squad presets`,
    description: "Squad structures that seed new rosters without mutating old ones.",
  };
}

export default async function SquadPresetsPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const { squadPresets, canAdmin } = getServerContext(serverId);

  return (
    <>
      <PageHeader
        title="Squad presets"
        description="These define the initial roster shape. New rosters copy from them so past events stay stable."
        actions={canAdmin ? <Button asChild className="rounded-xl"><a href={`/${locale}/dashboard/servers/${serverId}/squad-presets/create`}>Create preset</a></Button> : undefined}
      />
      <div className="px-4 lg:px-6">
        <ResourceTable
          rows={squadPresets}
          getHref={(preset) => `/${locale}/dashboard/servers/${serverId}/squad-presets/${preset.id}`}
          columns={[
            { key: "name", title: "Preset", render: (preset) => <div className="font-medium">{preset.name}</div> },
            { key: "groups", title: "Groups", render: (preset) => preset.squads.length },
            {
              key: "roles",
              title: "Role slots",
              render: (preset) =>
                preset.squads.reduce((sum, squad) => sum + squad.roles.reduce((roleSum, role) => roleSum + role.count, 0), 0),
            },
          ]}
        />
      </div>
    </>
  );
}
