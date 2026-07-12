import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { TopicPresetForm } from "@/components/app/topic-preset-form";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getTopicPresetMetadata } from "@/lib/server-metadata";
import { getServerContext } from "@/lib/server-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string; presetId: string }>;
}): Promise<Metadata> {
  const { presetId } = await params;
  const preset = await getTopicPresetMetadata(presetId);
  return {
    title: preset?.name ?? "Topic preset",
    description: preset?.notes,
  };
}

export function generateStaticParams() {
  return [{ presetId: "sample-topic-preset" }];
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
      <div className="px-4 lg:px-6">
        <TopicPresetForm preset={preset} serverId={serverId} locale={locale} canEdit={canAdmin} dictionary={dictionary} />
      </div>
    </>
  );
}
