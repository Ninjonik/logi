import type { Metadata } from "next";

import { CalendarView } from "@/components/app/calendar-view";
import { PageHeader } from "@/components/app/page-header";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getGuildMetadata } from "@/lib/server-metadata";
import { getServerContext } from "@/lib/server-context";

export const metadata: Metadata = {
  title: "Calendar | Logi",
  description: "View scheduled community events.",
};

export default async function ServerCalendarPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const context = await getServerContext(serverId);
  if (!context) return null;
  const { events, rosters, discordConfig, server, groups } = context;

  return (
    <>
      <PageHeader
        title={dictionary.calendarPage.title}
        description={dictionary.calendarPage.description}
      />
      <div className="px-4 lg:px-6">
        <CalendarView locale={locale as "en"} serverId={serverId} events={events} calendarItems={server.calendarItems ?? []} groups={groups} eventCategories={server.eventCategories ?? []} rosters={rosters} timezone={discordConfig?.timezone} dictionary={dictionary} signupLanguage={discordConfig?.defaultLanguage ?? "en"} />
      </div>
    </>
  );
}
