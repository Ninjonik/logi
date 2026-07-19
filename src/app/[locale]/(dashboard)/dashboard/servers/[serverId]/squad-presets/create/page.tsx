import { PageHeader } from "@/components/app/page-header";
import { SquadPresetEditor } from "@/components/app/squad-preset-editor";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";

export default async function CreateSquadPresetPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const context = await getServerContext(serverId);
  const canAdmin = context?.canAdmin ?? false;
  const groups = context?.groups ?? [];

  return (
    <>
      <PageHeader title={dictionary.presets.createSquadTitle} description={dictionary.presets.createSquadDescription} />
      <div className="px-4 lg:px-6">
        <SquadPresetEditor
          name=""
          squads={[]}
          groups={groups}
          canEdit={canAdmin}
          dictionary={dictionary}
          serverId={serverId}
          locale={locale}
          startInEditMode
        />
      </div>
    </>
  );
}
