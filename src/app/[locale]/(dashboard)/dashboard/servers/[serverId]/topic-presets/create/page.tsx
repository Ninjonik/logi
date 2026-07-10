import { PageHeader } from "@/components/app/page-header";
import { TopicPresetForm } from "@/components/app/topic-preset-form";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";

export default async function CreateTopicPresetPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const context = await getServerContext(serverId);
  const canAdmin = context?.canAdmin ?? false;

  return (
    <>
      <PageHeader title={dictionary.presets.createTopicTitle} description={dictionary.presets.createTopicDescription} />
      <div className="px-4 lg:px-6">
        <TopicPresetForm serverId={serverId} locale={locale} canEdit={canAdmin} dictionary={dictionary} createMode />
      </div>
    </>
  );
}
