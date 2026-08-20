import type { Metadata } from "next";
import Link from "next/link";
import { Github } from "lucide-react";
import { redirect } from "next/navigation";

import { LocaleSwitcher } from "@/components/app/locale-switcher";
import { DiscordSignInButton } from "@/components/auth/discord-sign-in-button";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getCurrentPlayer } from "@/lib/auth";
import { getPublicOverviewStats } from "@/lib/public-stats";

const githubHref = "https://github.com/ninjonik/logi";

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
  const stats = await getPublicOverviewStats();

  if (await getCurrentPlayer()) {
    redirect(`/${safeLocale}/dashboard`);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between py-2">
          <Link href={`/${safeLocale}`} className="text-lg font-semibold tracking-tight">
            Logi
          </Link>

          <div className="flex items-center gap-3">
            <LocaleSwitcher locale={safeLocale} dictionary={dictionary} compact />
            <DiscordSignInButton
              redirectTo={`/${safeLocale}/dashboard`}
              label={dictionary.auth.loginButton}
              className="h-10 w-auto px-4"
            />
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center py-16 sm:py-24">
          <div className="w-full max-w-3xl space-y-10 text-center">
            <div className="space-y-4">
              <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">Logi</h1>
              <p className="text-2xl text-muted-foreground sm:text-3xl">
                {dictionary.auth.heroSubtitle}
              </p>
            </div>

            <div className="grid gap-3 text-left sm:grid-cols-2">
              {[
                dictionary.auth.featureRosterManagement,
                dictionary.auth.featurePlayerPerformance,
                dictionary.auth.featureEventPlanning,
                dictionary.auth.featureOpenSource,
              ].map((feature) => (
                <div key={feature} className="rounded-xl border bg-card px-4 py-4 text-base font-medium">
                  {feature}
                </div>
              ))}
            </div>

            <div className="grid gap-3 text-left sm:grid-cols-4">
              <div className="rounded-xl border bg-card px-4 py-4">
                <div className="text-2xl font-semibold">{stats.players.toLocaleString("en-US")}</div>
                <div className="mt-1 text-sm text-muted-foreground">{dictionary.auth.statsPlayers}</div>
              </div>
              <div className="rounded-xl border bg-card px-4 py-4">
                <div className="text-2xl font-semibold">{stats.matches.toLocaleString("en-US")}</div>
                <div className="mt-1 text-sm text-muted-foreground">{dictionary.auth.statsMatches}</div>
              </div>
              <div className="rounded-xl border bg-card px-4 py-4">
                <div className="text-2xl font-semibold">{stats.teams.toLocaleString("en-US")}</div>
                <div className="mt-1 text-sm text-muted-foreground">{dictionary.auth.statsTeams}</div>
              </div>
              <div className="rounded-xl border bg-card px-4 py-4">
                <div className="text-2xl font-semibold">{stats.operations.toLocaleString("en-US")}</div>
                <div className="mt-1 text-sm text-muted-foreground">{dictionary.auth.statsOperations}</div>
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-4 border-t py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={githubHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Github className="size-4" />
            GitHub
          </Link>

          <Button asChild variant="outline">
            <Link href={githubHref} target="_blank" rel="noreferrer">
              {dictionary.auth.contributeButton}
            </Link>
          </Button>
        </footer>
      </div>
    </main>
  );
}
