import { redirect } from "next/navigation";

import { isLocale } from "@/i18n/config";
import { getStratmapDetail } from "@/lib/server-stratmaps";

export default async function PublicStratmapRedirectPage({
  params,
}: {
  params: Promise<{ locale: string; stratmapId: string }>;
}) {
  const { locale, stratmapId } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const detail = await getStratmapDetail(stratmapId);
  if (!detail) {
    return null;
  }

  redirect(`/${safeLocale}/dashboard/servers/${detail.serverId}/stratmaps/${detail.stratmap.id}`);
}
