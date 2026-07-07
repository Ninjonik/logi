import type { Metadata } from "next";

import { DiscordSettingsForm } from "@/components/app/discord-settings-form";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";
import { getDiscordConfigByGuild } from "@/lib/server-discord-settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string }>;
}): Promise<Metadata> {
  const { serverId } = await params;
  const context = await getServerContext(serverId);
  return {
    title: `${context?.server?.name ?? "Clan"} settings`,
    description: "Clan settings page for avatar, description, and membership management.",
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
  const { server, canAdmin, groups = [] } = context;
  const discordConfig = await getDiscordConfigByGuild(serverId);

  return (
    <>
      <PageHeader title={dictionary.serverSettings.title} description={dictionary.serverSettings.description} />
      <div className="space-y-6 px-4 lg:px-6">
        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardTitle>{server.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>{dictionary.serverSettings.frontendOnlyDescription}</div>
            <div>{dictionary.serverSettings.clanName}: {server.name}</div>
            <div>{dictionary.userSettings.avatarUrl}: {server.avatar}</div>
            {server.description ? <div>{dictionary.event.fields.description}: {server.description}</div> : null}
          </CardContent>
        </Card>
        {canAdmin ? (
          <DiscordSettingsForm
            serverId={serverId}
            dictionary={dictionary}
            groups={groups}
            config={discordConfig}
          />
        ) : null}
      </div>
    </>
  );
}
