import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { DiscordServerSettingsForm } from "@/components/app/discord-server-settings-form";
import { HelperDataActions } from "@/components/app/helper-data-actions";
import { ServerFrontendSettingsForm } from "@/components/app/server-frontend-settings-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getSiteUrl } from "@/lib/env";
import { getGuildMetadata } from "@/lib/server-metadata";
import { getServerContext } from "@/lib/server-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}): Promise<Metadata> {
  const { locale, serverId } = await params;
  const server = await getGuildMetadata(serverId);
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  return {
    title: `${server?.name ?? "Clan"} ${dictionary.serverSettings.title}`,
    description: dictionary.serverSettings.pageDescription,
  };
}

export default async function ServerSettingsPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const context = await getServerContext(serverId);
  if (!context) return null;
  const { server, canAdmin } = context;
  const guildLoginUrl = `${getSiteUrl()}/${locale}/guild-login/${server.discordId}`;

  return (
    <>
      <PageHeader title={dictionary.serverSettings.title} description={dictionary.serverSettings.pageDescription} />
      <div className="space-y-6 px-4 lg:px-6">
        {canAdmin ? <ServerFrontendSettingsForm server={server} dictionary={dictionary} guildLoginUrl={guildLoginUrl} /> : null}
        {canAdmin ? (
          <DiscordServerSettingsForm
            serverId={serverId}
            dictionary={dictionary}
            config={context.discordConfig}
          />
        ) : null}
        {canAdmin ? (
          <Card className="rounded-2xl border-border/60">
            <CardHeader>
              <CardTitle>{dictionary.clan.helperDataTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{dictionary.clan.helperDataBody}</p>
              <HelperDataActions serverId={serverId} dictionary={dictionary} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
