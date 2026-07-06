import type { Metadata } from "next";
import { Gamepad2, Languages, Link2 } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getCurrentPlayer, unlinkSteamForCurrentPlayer } from "@/lib/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  return {
    title: dictionary.userSettings.title,
    description: dictionary.userSettings.description,
  };
}

export default async function UserSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const user = await getCurrentPlayer();

  if (!user) {
    return null;
  }

  return (
    <>
      <PageHeader title={dictionary.userSettings.title} description={dictionary.userSettings.description} />
      <div className="grid gap-6 px-4 xl:grid-cols-[1.15fr_1fr] lg:px-6">
        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardTitle>{dictionary.userSettings.profile}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label={dictionary.userSettings.discordName} value={user.name} />
            <Field label={dictionary.userSettings.discordId} value={user.id} />
            <Field label={dictionary.userSettings.avatarUrl} value={user.avatar} />
            <Field label={dictionary.userSettings.preferredLanguage} value={dictionary.userSettings.english} />
            <Field label={dictionary.userSettings.steamId} value={user.steamId ?? dictionary.userSettings.notLinked} />
            <Field label={dictionary.userSettings.streamerMode} value={user.isStreamer ? dictionary.userSettings.enabled : dictionary.userSettings.disabled} />
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card className="rounded-2xl border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gamepad2 className="size-4" />
                {dictionary.userSettings.steamConnection}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant={user.steamId ? "default" : "secondary"} className="rounded-full px-3">
                {user.steamId ? dictionary.userSettings.steamConnected : dictionary.userSettings.steamDisconnected}
              </Badge>
              <Input defaultValue={user.steamId ?? ""} placeholder={dictionary.userSettings.steamOauthPlaceholder} readOnly className="rounded-xl" />
              <Button asChild className="w-full rounded-xl">
                <a href="/api/steam/link">
                  <Link2 className="size-4" />
                  {dictionary.userSettings.connectSteam}
                </a>
              </Button>
              {user.steamId ? (
                <form
                  action={async () => {
                    "use server";
                    await unlinkSteamForCurrentPlayer();
                  }}
                >
                  <Button type="submit" variant="outline" className="w-full rounded-xl">
                    <Link2 className="size-4" />
                    {dictionary.userSettings.unlinkSteam}
                  </Button>
                </form>
              ) : null}
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="size-4" />
                {dictionary.userSettings.i18nReadiness}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{dictionary.userSettings.localeRoutingActive}</p>
              <p>{dictionary.userSettings.englishDefault}</p>
              <p>{dictionary.userSettings.addMoreLanguages}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium">{label}</div>
      <Input defaultValue={value} className="rounded-xl" />
    </div>
  );
}
