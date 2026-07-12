import type { Metadata } from "next";

import { CalendarView } from "@/components/app/calendar-view";
import { PageHeader } from "@/components/app/page-header";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getGuildMetadata } from "@/lib/server-metadata";
import { getServerContext } from "@/lib/server-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string; locale: string }>;
}): Promise<Metadata> {
  const { serverId, locale } = await params;
  const server = await getGuildMetadata(serverId);
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  return {
    title: `${server?.name ?? "Clan"} ${dictionary.calendarPage.title}`,
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
  const context = await getServerContext(serverId);
  if (!context) return null;
  const { events, rosters, discordConfig } = context;

  return (
    <>
      <PageHeader
        title={dictionary.calendarPage.title}
        description={dictionary.calendarPage.description}
      />
      <div className="px-4 lg:px-6">
        <CalendarView locale={locale as "en"} serverId={serverId} events={events} rosters={rosters} timezone={discordConfig?.timezone} dictionary={dictionary} />
      </div>
    </>
  );
}
