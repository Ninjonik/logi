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
  const { canAdmin } = getServerContext(serverId);

  return (
    <>
      <PageHeader title="Create topic preset" description="Create and edit topic structure in one place." />
      <div className="grid gap-6 px-4 xl:grid-cols-[1.2fr_1fr] lg:px-6">
        <EditableResourceDetail
          title="Preset details"
          description="Create mode starts directly in edit mode."
          canEdit={canAdmin}
          dictionary={dictionary}
          startInEditMode
          fields={[
            { label: "Name", value: "" },
            { label: "Map", value: "" },
            { label: "Side", value: "" },
            { label: "Cap", value: "" },
            { label: "Notes", value: "", multiline: true },
          ]}
        />
        <TopicEditor topics={[]} canEdit={canAdmin} dictionary={dictionary} startInEditMode />
      </div>
    </>
  );
}
