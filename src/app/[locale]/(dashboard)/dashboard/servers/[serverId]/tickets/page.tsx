import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { TicketSettingsForm } from "@/components/app/ticket-settings-form";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getGuildMetadata } from "@/lib/server-metadata";
import { getServerContext } from "@/lib/server-context";
import { getDiscordConfigByGuild } from "@/lib/server-discord-settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}): Promise<Metadata> {
  const { locale, serverId } = await params;
  const server = await getGuildMetadata(serverId);
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  return {
    title: `${server?.name ?? "Clan"} ${dictionary.ticketSettings.title}`,
    description: dictionary.ticketSettings.pageDescription,
  };
}

export default async function ServerTicketsPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const context = await getServerContext(serverId);
  if (!context?.canAdmin) return null;
  const discordConfig = await getDiscordConfigByGuild(serverId);

  return (
    <>
      <PageHeader title={dictionary.ticketSettings.title} description={dictionary.ticketSettings.pageDescription} />
      <div className="space-y-6 px-4 lg:px-6">
        <TicketSettingsForm
          serverId={serverId}
          dictionary={dictionary}
          config={discordConfig}
        />
      </div>
    </>
  );
}
