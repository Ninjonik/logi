import type { Metadata } from "next";
import { Bot } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { RefreshBotStatusButton } from "@/components/app/refresh-bot-status-button";
import { ServerCard } from "@/components/app/server-card";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getCurrentPlayer, getVisibleGuildsForLoggedInUser } from "@/lib/auth";
import { buildDiscordBotInviteUrl } from "@/lib/discord";

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
  const user = await getCurrentPlayer();

  if (!user) {
    return null;
  }

  const visibleGuilds = await getVisibleGuildsForLoggedInUser();
  const mainServer = user.guildId ? visibleGuilds.find((guild) => guild.discordId === user.guildId) : undefined;
  const managedServers = visibleGuilds.filter((guild) => user.managedGuildIds.includes(guild.discordId));
  const readyManagedServers = managedServers.filter((guild) => guild.botInside);
  const managedServersMissingBot = managedServers.filter((guild) => !guild.botInside);
  const mercenaryServers = visibleGuilds.filter((guild) => user.mercenaryGuildIds.includes(guild.discordId));

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
              <ServerCard locale={safeLocale} guild={mainServer} label={dictionary.dashboard.homeServer} dictionary={dictionary} />
            </div>
          </section>
        ) : null}
        {managedServers.length ? (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  {dictionary.dashboard.managedServers}
                </h2>
                {managedServersMissingBot.length ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {dictionary.dashboard.inviteBotHint}
                  </p>
                ) : null}
              </div>
              {managedServersMissingBot.length ? (
                <div className="flex flex-wrap gap-2">
                  <RefreshBotStatusButton dictionary={dictionary} />
                  {managedServersMissingBot.map((guild) => (
                    <Button key={guild.id} asChild variant="outline" className="rounded-full">
                      <a href={buildDiscordBotInviteUrl(guild.discordId)} target="_blank" rel="noreferrer">
                        <Bot className="size-4" />
                        {guild.name}
                      </a>
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
            {readyManagedServers.length ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {readyManagedServers.map((guild) => (
                  <ServerCard key={guild.id} locale={safeLocale} guild={guild} label={dictionary.dashboard.managedServers} dictionary={dictionary} />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
        {mercenaryServers.length ? (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {dictionary.dashboard.mercenaryServers}
            </h2>
            <div className="grid gap-4 xl:grid-cols-2">
              {mercenaryServers.map((guild) => (
                <ServerCard key={guild.id} locale={safeLocale} guild={guild} label={dictionary.dashboard.mercenaryServers} dictionary={dictionary} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
