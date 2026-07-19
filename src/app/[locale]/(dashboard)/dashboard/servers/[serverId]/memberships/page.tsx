import type { Metadata } from "next";

import { MembershipSettingsForm } from "@/components/app/membership-settings-form";
import { PageHeader } from "@/components/app/page-header";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getDiscordConfigByGuild } from "@/lib/server-discord-settings";
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
    title: `${server?.name ?? "Clan"} ${dictionary.membershipSettings.title}`,
    description: dictionary.membershipSettings.pageDescription,
  };
}

export default async function ServerMembershipsPage({
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
      <PageHeader title={dictionary.membershipSettings.title} description={dictionary.membershipSettings.pageDescription} />
      <div className="space-y-6 px-4 lg:px-6">
        <MembershipSettingsForm serverId={serverId} config={discordConfig} dictionary={dictionary} />
      </div>
    </>
  );
}
