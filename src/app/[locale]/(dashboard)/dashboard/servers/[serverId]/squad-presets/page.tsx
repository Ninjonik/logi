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
  const context = await getServerContext(serverId);
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  return {
    title: `${context?.server?.name ?? "Clan"} ${dictionary.presets.squadTitle}`,
    description: dictionary.presets.squadPresetMetaDescription,
  };
}

export default async function SquadPresetsPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const context = await getServerContext(serverId);
  if (!context) return null;
  const { squadPresets, canAdmin } = context;

  return (
    <>
      <PageHeader
        title={dictionary.presets.squadTitle}
        description={dictionary.presets.squadDescription}
        actions={canAdmin ? <Button asChild className="rounded-xl"><a href={`/${locale}/dashboard/servers/${serverId}/squad-presets/create`}>{dictionary.common.createPreset}</a></Button> : undefined}
      />
      <div className="px-4 lg:px-6">
        <ResourceTable
          dictionary={dictionary}
          rows={squadPresets}
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
      </div>
    </>
  );
}
