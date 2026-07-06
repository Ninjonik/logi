import type { Metadata } from "next";
import { ArrowRight, Disc3, Shield } from "lucide-react";
import { redirect } from "next/navigation";

import { AppLogo } from "@/components/app/app-logo";
import { LocaleSwitcher } from "@/components/app/locale-switcher";
import { DiscordSignInButton } from "@/components/auth/discord-sign-in-button";
import { Card, CardContent } from "@/components/ui/card";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getCurrentPlayer } from "@/lib/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");

  return {
    title: dictionary.auth.loginTitle,
    description: dictionary.auth.loginDescription,
    openGraph: {
      title: dictionary.auth.loginTitle,
      description: dictionary.auth.loginDescription,
    },
  };
}

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(201,168,78,.20),transparent_30%),linear-gradient(180deg,#101826,#0a0f18)] px-6 py-12 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(72,96,49,.12)_35%,transparent_70%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:56px_56px]" />
      <div className="absolute top-6 right-6 z-10 hidden sm:block">
        <div className="rounded-full border border-white/10 bg-black/20 px-2 py-1 backdrop-blur">
          <LocaleSwitcher locale={safeLocale} dictionary={dictionary} />
        </div>
      </div>
      <div className="relative grid w-full max-w-6xl gap-10 lg:grid-cols-[1.2fr_460px] lg:items-center">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
            <AppLogo />
            {dictionary.app.tagline}
          </div>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance">
              {dictionary.auth.loginTitle}
            </h1>
            <p className="max-w-2xl text-lg text-slate-300">{dictionary.auth.loginDescription}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FeatureCard title={dictionary.auth.featureRostersTitle} body={dictionary.auth.featureRostersBody} />
            <FeatureCard title={dictionary.auth.featureBriefingsTitle} body={dictionary.auth.featureBriefingsBody} />
            <FeatureCard title={dictionary.auth.featureDiscordTitle} body={dictionary.auth.featureDiscordBody} />
          </div>
        </div>
        <Card className="rounded-[28px] border-white/10 bg-white/6 text-white shadow-2xl shadow-black/30 backdrop-blur-xl">
          <CardContent className="space-y-8 p-8">
            <div className="space-y-3">
              <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-emerald-200">
                {dictionary.auth.englishEnabled}
              </div>
              <h2 className="text-2xl font-semibold">{dictionary.auth.discordAccessOnly}</h2>
              <p className="text-sm text-slate-300">{dictionary.auth.loginHint}</p>
            </div>
            <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-[#5865F2]">
                  <Disc3 className="size-5" />
                </div>
                <div>
                  <div className="font-medium">{dictionary.auth.discordOauth}</div>
                  <div className="text-sm text-slate-400">{dictionary.auth.discordOauthBody}</div>
                </div>
              </div>
              <DiscordSignInButton
                redirectTo={`/${safeLocale}/dashboard`}
                label={dictionary.auth.loginButton}
              />
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              <div className="mb-2 flex items-center gap-2 font-medium text-white">
                <Shield className="size-4 text-[#c9a84e]" />
                {dictionary.auth.plannedBackendHooks}
              </div>
              <p>{dictionary.auth.plannedBackendHooksBody}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
      <div className="text-sm uppercase tracking-[0.25em] text-[#c9a84e]">{title}</div>
      <p className="mt-3 text-sm text-slate-300">{body}</p>
    </div>
  );
}
