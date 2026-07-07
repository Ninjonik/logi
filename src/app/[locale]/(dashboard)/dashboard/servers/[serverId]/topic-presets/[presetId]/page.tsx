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
  const context = await getServerContext(serverId);
  const preset = context?.topicPresets.find((item) => item.id === presetId);
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
  const context = await getServerContext(serverId);
  if (!context) return null;
  const { topicPresets, canAdmin } = context;
  const preset = topicPresets.find((item) => item.id === presetId);

  if (!preset) return null;

  return (
    <>
      <PageHeader title={preset.name} description={preset.notes} />
      <div className="grid gap-6 px-4 xl:grid-cols-[1.2fr_1fr] lg:px-6">
        <EditableResourceDetail
          title={dictionary.presets.presetDetails}
          description={dictionary.presets.topicPresetPageDescription}
          canEdit={canAdmin}
          dictionary={dictionary}
          fields={[
            { label: dictionary.presets.fields.name, value: preset.name },
            { label: dictionary.presets.fields.map, value: preset.map },
            { label: dictionary.presets.fields.side, value: preset.side },
            { label: dictionary.presets.fields.cap, value: preset.cap },
            { label: dictionary.presets.fields.notes, value: preset.notes, multiline: true },
          ]}
          createMode={false}
        />
        <TopicEditor topics={preset.topics} canEdit={canAdmin} dictionary={dictionary} />
      </div>
    </>
  );
}
