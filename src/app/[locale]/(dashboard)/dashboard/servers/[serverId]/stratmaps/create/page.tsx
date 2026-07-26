import { PageHeader } from "@/components/app/page-header";
import { StratmapCreateForm } from "@/components/app/stratmap-create-form";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";

export default async function CreateStratmapPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const context = await getServerContext(serverId);

  if (!context?.canAdmin) {
    return null;
  }

  return (
    <>
      <PageHeader title={dictionary.stratmaps.createTitle} description={dictionary.stratmaps.createDescription} />
      <div className="px-4 lg:px-6">
        <StratmapCreateForm
          locale={locale}
          serverId={serverId}
          userId={context.user.discordId}
          dictionary={dictionary}
          defaultTitle={dictionary.stratmaps.createTitle}
        />
      </div>
    </>
  );
}
