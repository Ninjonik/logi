import { StratmapEditor } from "@/components/app/stratmap-editor";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getPublicStratmapDetail } from "@/lib/server-stratmaps";

export default async function PublicStratmapRedirectPage({
  params,
}: {
  params: Promise<{ locale: string; stratmapId: string }>;
}) {
  const { locale, stratmapId } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const stratmap = await getPublicStratmapDetail(stratmapId);
  if (!stratmap) {
    return null;
  }
  return <div className="h-dvh p-4"><StratmapEditor locale={safeLocale} userId="public" stratmapId={stratmapId} initialCanAdmin={false} initialStratmap={stratmap} dictionary={getDictionary(safeLocale)} /></div>;
}
