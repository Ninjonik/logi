import type { Metadata } from "next";

import { EditableResourceDetail } from "@/components/app/editable-resource-detail";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";

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
  const { server, canAdmin } = context;

  return (
    <>
      <PageHeader title={dictionary.serverSettings.title} description={dictionary.serverSettings.description} />
      <div className="px-4">
        <EditableResourceDetail
          title={server.name}
          description={dictionary.serverSettings.frontendOnlyDescription}
          canEdit={canAdmin}
          dictionary={dictionary}
          fields={[
            { label: dictionary.serverSettings.clanName, value: server.name },
            { label: dictionary.userSettings.avatarUrl, value: server.avatar },
            { label: dictionary.event.fields.description, value: server.description, multiline: true },
          ]}
          createMode={false}
        />
      </div>
    </>
  );
}
