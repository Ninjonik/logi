import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { DiscordServerSettingsForm } from "@/components/app/discord-server-settings-form";
import { ServerFrontendSettingsForm } from "@/components/app/server-frontend-settings-form";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";
import { getDiscordConfigByGuild } from "@/lib/server-discord-settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}): Promise<Metadata> {
  const { locale, serverId } = await params;
  const context = await getServerContext(serverId);
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  return {
    title: `${context?.server?.name ?? "Clan"} ${dictionary.serverSettings.title}`,
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
  const discordConfig = await getDiscordConfigByGuild(serverId);

  return (
    <>
      <PageHeader title={dictionary.serverSettings.title} description={dictionary.serverSettings.pageDescription} />
      <div className="space-y-6 px-4 lg:px-6">
        {canAdmin ? <ServerFrontendSettingsForm server={server} dictionary={dictionary} /> : null}
        {canAdmin ? (
          <DiscordServerSettingsForm
            serverId={serverId}
            dictionary={dictionary}
            config={discordConfig}
          />
        ) : null}
      </div>
    </>
  );
}
