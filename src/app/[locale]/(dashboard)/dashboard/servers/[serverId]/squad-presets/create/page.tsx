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
  const { canAdmin } = getServerContext(serverId);

  return (
    <>
      <PageHeader title="Create squad preset" description="Create and reshape the preset structure in one place." />
      <div className="px-4 lg:px-6">
        <SquadPresetEditor name="" squads={[]} canEdit={canAdmin} dictionary={dictionary} startInEditMode />
      </div>
    </>
  );
}
