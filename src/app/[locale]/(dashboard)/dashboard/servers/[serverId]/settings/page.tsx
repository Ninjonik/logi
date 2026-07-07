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
      <div className="grid gap-6 px-4 xl:grid-cols-[1.2fr_1fr] lg:px-6">
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
        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardTitle>{dictionary.serverSettings.accessModel}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{dictionary.serverSettings.accessAdmins}</p>
            <p>{dictionary.serverSettings.accessMembers}</p>
            <p>{dictionary.serverSettings.accessBackend}</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
