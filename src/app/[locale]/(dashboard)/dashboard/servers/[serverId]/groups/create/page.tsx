import { PageHeader } from "@/components/app/page-header";
import { GroupForm } from "@/components/app/group-form";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";

export default async function CreateGroupPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const context = await getServerContext(serverId);
  if (!context) return null;

  return (
    <>
      <PageHeader title={dictionary.groups.createTitle} description={dictionary.groups.createDescription} />
      <div className="px-4 lg:px-6">
        <GroupForm
          serverId={serverId}
          locale={locale}
          dictionary={dictionary}
          createMode
          availableGroups={context.groups ?? []}
        />
      </div>
    </>
  );
}
