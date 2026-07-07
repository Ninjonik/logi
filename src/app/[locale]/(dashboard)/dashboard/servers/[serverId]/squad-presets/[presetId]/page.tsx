import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { SquadPresetEditor } from "@/components/app/squad-preset-editor";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string; presetId: string }>;
}): Promise<Metadata> {
  const { serverId, presetId } = await params;
  const context = await getServerContext(serverId);
  const preset = context?.squadPresets.find((item) => item.id === presetId);
  return {
    title: preset?.name ?? "Squad preset",
    description: "Preset squad structure for new rosters.",
  };
}

export default async function SquadPresetDetailPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string; presetId: string }>;
}) {
  const { locale, serverId, presetId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const context = await getServerContext(serverId);
  if (!context) return null;
  const { squadPresets, canAdmin, groups = [] } = context;
  const preset = squadPresets.find((item) => item.id === presetId);

  if (!preset) return null;

  return (
    <>
      <PageHeader title={preset.name} description={dictionary.presets.squadPresetPageDescription} />
      <div className="px-4 lg:px-6">
        <SquadPresetEditor name={preset.name} squads={preset.squads} groups={groups} canEdit={canAdmin} dictionary={dictionary} />
      </div>
    </>
  );
}
