import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { ServerCard } from "@/components/app/server-card";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getCurrentUser, getGuild, mockGuilds } from "@/lib/mock-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  return {
    title: dictionary.dashboard.title,
    description: dictionary.dashboard.description,
  };
}

export default async function DashboardHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const user = getCurrentUser();

  const mainServer = user.guildId ? getGuild(user.guildId) : undefined;
  const managedServers = mockGuilds.filter((guild) => user.managedGuildIds.includes(guild.id));
  const mercenaryServers = mockGuilds.filter((guild) => user.mercenaryGuildIds.includes(guild.id));

  return (
    <>
      <PageHeader title={dictionary.dashboard.title} description={dictionary.dashboard.description} />
      <div className="space-y-8 px-4 lg:px-6">
        {mainServer ? (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {dictionary.dashboard.homeServer}
            </h2>
            <div className="grid gap-4 xl:grid-cols-2">
              <ServerCard locale={safeLocale} guild={mainServer} label={dictionary.dashboard.homeServer} />
            </div>
          </section>
        ) : null}
        {managedServers.length ? (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {dictionary.dashboard.managedServers}
            </h2>
            <div className="grid gap-4 xl:grid-cols-2">
              {managedServers.map((guild) => (
                <ServerCard key={guild.id} locale={safeLocale} guild={guild} label={dictionary.dashboard.managedServers} />
              ))}
            </div>
          </section>
        ) : null}
        {mercenaryServers.length ? (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {dictionary.dashboard.mercenaryServers}
            </h2>
            <div className="grid gap-4 xl:grid-cols-2">
              {mercenaryServers.map((guild) => (
                <ServerCard key={guild.id} locale={safeLocale} guild={guild} label={dictionary.dashboard.mercenaryServers} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
