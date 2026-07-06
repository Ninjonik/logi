import type { Metadata } from "next";
import { Gamepad2, Languages, Link2 } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/mock-data";

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
  const user = getCurrentUser();

  return (
    <>
      <PageHeader title={dictionary.userSettings.title} description={dictionary.userSettings.description} />
      <div className="grid gap-6 px-4 xl:grid-cols-[1.15fr_1fr] lg:px-6">
        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Discord name" value={user.name} />
            <Field label="Discord ID" value={user.id} />
            <Field label="Avatar URL" value={user.avatar} />
            <Field label="Preferred language" value="English" />
            <Field label="Steam ID" value={user.steamId ?? "Not linked"} />
            <Field label="Streamer mode" value={user.isStreamer ? "Enabled" : "Disabled"} />
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card className="rounded-2xl border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gamepad2 className="size-4" />
                Steam connection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant={user.steamId ? "default" : "secondary"} className="rounded-full px-3">
                {user.steamId ? dictionary.userSettings.steamConnected : dictionary.userSettings.steamDisconnected}
              </Badge>
              <Input defaultValue={user.steamId ?? ""} placeholder="Steam ID will be filled by OAuth later" className="rounded-xl" />
              <Button className="w-full rounded-xl">
                <Link2 className="size-4" />
                {dictionary.userSettings.connectSteam}
              </Button>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="size-4" />
                i18n readiness
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Locale routing is already active under `/{locale}`.</p>
              <p>English is the default language, and all new pages read from shared dictionaries.</p>
              <p>Additional languages can be added by extending the dictionary object and locale list.</p>
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
