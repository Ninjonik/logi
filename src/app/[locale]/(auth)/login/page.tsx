import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DiscordSignInButton } from "@/components/auth/discord-sign-in-button";
import { Logo } from "@/components/logo";
import { PublicPage, PublicSiteShell } from "@/components/public/public-site-shell";
import { Card, CardContent } from "@/components/ui/card";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getCurrentPlayer } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in | Logi",
  description: "Sign in to continue to Logi.",
};

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  if (await getCurrentPlayer()) {
    redirect(`/${safeLocale}/dashboard`);
  }

  return (
    <PublicSiteShell locale={safeLocale}><PublicPage className="flex max-w-sm items-center">
      <Card className="w-full max-w-sm rounded-2xl border-white/10 bg-white/6 text-white shadow-2xl shadow-black/30 backdrop-blur-xl">
        <CardContent className="flex flex-col items-center gap-7 p-8 text-center">
          <div className="flex size-28 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
            <Logo size={64} />
          </div>
          <div className="w-full space-y-3">
            <h1 className="text-2xl font-semibold">{dictionary.app.name}</h1>
            <DiscordSignInButton redirectTo={`/${safeLocale}/dashboard`} label={dictionary.auth.loginButton} />
          </div>
        </CardContent>
      </Card>
    </PublicPage></PublicSiteShell>
  );
}
