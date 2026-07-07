import { EditableResourceDetail } from "@/components/app/editable-resource-detail";
import { PageHeader } from "@/components/app/page-header";
import { TopicEditor } from "@/components/app/topic-editor";
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
      <div className="grid gap-6 px-4 xl:grid-cols-[1.2fr_1fr] lg:px-6">
        <EditableResourceDetail
          title={dictionary.presets.presetDetails}
          description={dictionary.shared.createMode}
          canEdit={canAdmin}
          dictionary={dictionary}
          startInEditMode
          fields={[
            { label: dictionary.presets.fields.name, value: "" },
            { label: dictionary.presets.fields.map, value: "" },
            { label: dictionary.presets.fields.side, value: "" },
            { label: dictionary.presets.fields.cap, value: "" },
            { label: dictionary.presets.fields.notes, value: "", multiline: true },
          ]}
          createMode={true}
        />
        <TopicEditor topics={[]} canEdit={canAdmin} dictionary={dictionary} startInEditMode />
      </div>
    </>
  );
}
