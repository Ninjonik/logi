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
  const context = getServerContext(serverId);
  return {
    title: `${context.server?.name ?? "Server"} settings`,
    description: "Guild settings page for avatar, description, and membership management.",
  };
}

export default async function ServerSettingsPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const { server, canAdmin } = getServerContext(serverId);
  if (!server) return null;

  return (
    <>
      <PageHeader title={dictionary.serverSettings.title} description={dictionary.serverSettings.description} />
      <div className="grid gap-6 px-4 xl:grid-cols-[1.2fr_1fr] lg:px-6">
        <EditableResourceDetail
          title={server.name}
          description="Frontend-only guild configuration for now."
          canEdit={canAdmin}
          dictionary={dictionary}
          fields={[
            { label: "Server name", value: server.name },
            { label: "Avatar URL", value: server.avatar },
            { label: "Description", value: server.description, multiline: true },
          ]}
        />
        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardTitle>Access model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Admins: full access to events, presets, rosters, and server settings.</p>
            <p>Members and mercenaries: calendar visibility plus published rosters only.</p>
            <p>Later backend work can connect these rules to Discord roles and Convex queries.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
