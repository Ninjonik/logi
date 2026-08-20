import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Github, HeartHandshake, Shield, SquareTerminal } from "lucide-react";

import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { defaultLocale } from "@/i18n/config";
import { getCurrentPlayer } from "@/lib/auth";

const githubHref = "https://github.com/ninjonik/logi";

const pillars = [
  {
    title: "Runs the boring parts",
    description:
      "Logi handles scheduling, signups, roster organization, match prep, and the Discord-side glue that usually ends up scattered across bots, sheets, and pinned messages.",
    icon: SquareTerminal,
  },
  {
    title: "Built for real communities",
    description:
      "This is not a generic team dashboard with gaming paint on it. It is meant for clans, units, and organized groups that need structure without extra ceremony.",
    icon: Shield,
  },
  {
    title: "Open to contributors",
    description:
      "The project is open source, open to pull requests, and intended to improve in public with people who actually use it.",
    icon: HeartHandshake,
  },
];

const promises = [
  "Free to use",
  "Source available on GitHub",
  "Contributions welcome",
  "No marketing filler",
];

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const resolvedLocale = locale || defaultLocale;
  const isAuthenticated = Boolean(await getCurrentPlayer());

  if (isAuthenticated) {
    redirect(`/${resolvedLocale}/dashboard`);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between border-b pb-5">
          <Link
            href={`/${resolvedLocale}`}
            className="inline-flex items-center gap-3 text-sm font-medium tracking-[0.18em] uppercase"
          >
            <span className="flex size-11 items-center justify-center rounded-xl border bg-card">
              <Logo size={22} />
            </span>
            <span>Logi</span>
          </Link>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost">
              <Link href={githubHref} target="_blank" rel="noreferrer">
                <Github />
                GitHub
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/${resolvedLocale}/login`}>
                Open App
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1.2fr_0.8fr] lg:py-20">
          <div className="space-y-8">
            <div className="space-y-4">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Discord operations for organized groups
              </Badge>
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Logi keeps community operations readable, structured, and in one place.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Logi is an open-source platform for groups that run events, rosters, trainings,
                matches, and Discord coordination. It exists to replace the usual pile of ad-hoc
                bots, spreadsheets, and guesswork with one system that people can actually follow.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={`/${resolvedLocale}/login`}>
                  Sign in with Discord
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={githubHref} target="_blank" rel="noreferrer">
                  Contribute on GitHub
                </Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {promises.map((promise) => (
                <div
                  key={promise}
                  className="rounded-xl border bg-card px-4 py-3 text-sm font-medium"
                >
                  {promise}
                </div>
              ))}
            </div>
          </div>

          <Card className="border-border/70 bg-card/80 shadow-none">
            <CardHeader className="gap-3">
              <CardTitle className="text-2xl">What it actually does</CardTitle>
              <CardDescription className="text-sm leading-6">
                The point is simple: plan events, manage signups, build rosters, prepare matches,
                keep Discord synchronized, and let contributors improve the tooling instead of
                working around it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3">
                <div className="rounded-lg border px-4 py-3">
                  Events, trainings, and match workflows
                </div>
                <div className="rounded-lg border px-4 py-3">
                  Roster and attendance management
                </div>
                <div className="rounded-lg border px-4 py-3">
                  Discord-linked server administration
                </div>
                <div className="rounded-lg border px-4 py-3">
                  Shared tooling for communities that want control
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <Separator />

        <section className="grid gap-5 py-10 lg:grid-cols-3">
          {pillars.map(({ title, description, icon: Icon }) => (
            <Card key={title} className="shadow-none">
              <CardHeader className="gap-4">
                <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
                  <Icon className="size-4" />
                </div>
                <div className="space-y-2">
                  <CardTitle>{title}</CardTitle>
                  <CardDescription className="leading-6">{description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section className="border-t py-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-3">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Contribution and access
              </p>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Logi is meant to stay free, useful, and open to people who want to build it.
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                If you want to improve the bot, the dashboard, the deployment story, or the way the
                platform handles real community logistics, contribute to the repository. If you just
                need the tool, use it. If you want to help shape it, send a pull request.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" size="lg">
                <Link href={githubHref} target="_blank" rel="noreferrer">
                  <Github />
                  View Repository
                </Link>
              </Button>
              <Button asChild size="lg">
                <Link href={`/${resolvedLocale}/login`}>
                  Open Logi
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
