import type { Metadata } from "next";

import { CalendarView } from "@/components/app/calendar-view";
import { PageHeader } from "@/components/app/page-header";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string; locale: string }>;
}): Promise<Metadata> {
  const { serverId, locale } = await params;
  const context = getServerContext(serverId);
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  return {
    title: `${context.server?.name ?? "Clan"} ${dictionary.calendarPage.title}`,
    description: dictionary.calendarPage.description,
  };
}

export default async function ServerCalendarPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const { server, events, rosters } = getServerContext(serverId);
  if (!server) return null;

  return (
    <>
      <PageHeader
        title={dictionary.calendarPage.title}
        description={dictionary.calendarPage.description}
      />
      <div className="px-4 lg:px-6">
        <CalendarView locale={locale as "en"} serverId={serverId} events={events} rosters={rosters} dictionary={dictionary} />
      </div>
    </>
  );
}
