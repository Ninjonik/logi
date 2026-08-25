import { PageHeader } from "@/components/app/page-header";
import { StratmapEditor } from "@/components/app/stratmap-editor";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";

export default async function StratmapDetailPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string; stratmapId: string }>;
}) {
  const { locale, serverId, stratmapId } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const context = await getServerContext(serverId);

  if (!context) {
    return null;
  }

  const stratmap = context.stratmaps.find((item) => item.id === stratmapId);
  if (!stratmap) {
    return null;
  }

  return (
    <div className="grid h-[calc(100dvh-var(--header-height)-var(--footer-height)-1.5rem)] max-h-[calc(100dvh-var(--header-height)-var(--footer-height)-1.5rem)] min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:h-[calc(100dvh-var(--header-height)-var(--footer-height)-2rem)] sm:max-h-[calc(100dvh-var(--header-height)-var(--footer-height)-2rem)] 2xl:h-[calc(100dvh-var(--header-height)-var(--footer-height)-3rem)] 2xl:max-h-[calc(100dvh-var(--header-height)-var(--footer-height)-3rem)]">
      <PageHeader title={stratmap.title} description={stratmap.description ?? dictionary.stratmaps.detailDescription} />
      <div className="min-h-0 flex-1 overflow-hidden px-4 pt-2 lg:px-6 2xl:pt-4">
        <div className="h-full overflow-hidden">
          <StratmapEditor
            locale={locale}
            userId={context.user.discordId}
            stratmapId={stratmapId}
            initialCanAdmin={context.canAdmin}
            initialStratmap={stratmap}
            dictionary={dictionary}
          />
        </div>
      </div>
    </div>
  );
}
