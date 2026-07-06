import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { EditableResourceDetail } from "@/components/app/editable-resource-detail";
import { TopicEditor } from "@/components/app/topic-editor";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string; presetId: string }>;
}): Promise<Metadata> {
  const { serverId, presetId } = await params;
  const preset = getServerContext(serverId).topicPresets.find((item) => item.id === presetId);
  return {
    title: preset?.name ?? "Topic preset",
    description: preset?.notes,
  };
}

export default async function TopicPresetDetailPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string; presetId: string }>;
}) {
  const { locale, serverId, presetId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const { topicPresets, canAdmin } = getServerContext(serverId);
  const preset = topicPresets.find((item) => item.id === presetId);

  if (!preset) return null;

  return (
    <>
      <PageHeader title={preset.name} description={preset.notes} />
      <div className="grid gap-6 px-4 xl:grid-cols-[1.2fr_1fr] lg:px-6">
        <EditableResourceDetail
          title="Preset details"
          description="Same structure as events, but focused on reusable briefing content."
          canEdit={canAdmin}
          dictionary={dictionary}
          fields={[
            { label: "Name", value: preset.name },
            { label: "Map", value: preset.map },
            { label: "Side", value: preset.side },
            { label: "Cap", value: preset.cap },
            { label: "Notes", value: preset.notes, multiline: true },
          ]}
        />
        <TopicEditor topics={preset.topics} canEdit={canAdmin} dictionary={dictionary} />
      </div>
    </>
  );
}
