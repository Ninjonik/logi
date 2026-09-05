import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicBreadcrumbs } from "@/components/public/public-breadcrumbs";
import { PublicPage, PublicSiteShell } from "@/components/public/public-site-shell";
import { deriveDivisionStandings } from "@/domain/competitions/standings";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getPublicCompetition } from "@/lib/read-models/competitions";

type Props = { params: Promise<{ locale: string; slug: string }> };
const ECL_LOGO = "https://hll-ecl.eu/static/assets/ecl_logo_web_2025.png";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const competition = await getPublicCompetition(slug);
  return { title: competition ? `${competition.name} ${competition.season} | Logi` : "Competition | Logi", description: competition ? `${competition.name} standings and match results.` : "Competition standings." };
}

export default async function CompetitionPage({ params }: Props) {
  const { locale, slug } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const competition = await getPublicCompetition(slug);
  if (!competition) notFound();
  const isEcl = competition.slug === "ecl-2026";

  return <PublicSiteShell locale={safeLocale}><PublicPage>
    <div className="space-y-8">
      <PublicBreadcrumbs items={[{ label: dictionary.app.name, href: `/${safeLocale}` }, { label: dictionary.competition.title, href: `/${safeLocale}/competitions` }, { label: competition.name }]} />
      <section className="rounded-3xl border bg-card p-5 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4"><div className="flex size-20 shrink-0 items-center justify-center rounded-2xl border bg-background p-2"><img src={ECL_LOGO} alt="ECL" className="max-h-full max-w-full object-contain" /></div><div><h1 className="text-3xl font-semibold tracking-tight">{competition.name}</h1><p className="mt-1 text-muted-foreground">{competition.season} season · standings and results tracked by Logi</p></div></div>
          {isEcl ? <div className="flex flex-wrap gap-2"><a className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium hover:bg-muted" href="https://hll-ecl.eu" target="_blank" rel="noreferrer">Official website <ExternalLink className="size-4" /></a><a className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium hover:bg-muted" href="https://hll-ecl.eu/rules" target="_blank" rel="noreferrer">Official rules <ExternalLink className="size-4" /></a></div> : null}
        </div>
      </section>
      {competition.divisions.map(division => {
        const standings = deriveDivisionStandings(division.teams, division.fixtures);
        const names = new Map(division.teams.map(team => [team.id, team.name]));
        return <Card key={division.id} className="overflow-hidden"><CardHeader className="border-b"><CardTitle>{division.name}</CardTitle></CardHeader><CardContent className="space-y-6 p-0"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-muted/40 text-left text-muted-foreground"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Team</th><th className="px-4 py-3 text-right">Cap Score</th><th className="px-4 py-3 text-right">Regular Wins</th><th className="px-4 py-3 text-right">Total Wins</th><th className="px-4 py-3 text-right">Regular Matches</th><th className="px-4 py-3 text-right">Total Matches</th></tr></thead><tbody>{standings.map((row, index) => <tr key={row.teamId} className="border-t"><td className="px-4 py-3">{index + 1}</td><td className="px-4 py-3 font-medium">{row.name}{division.teams.find(team => team.id === row.teamId)?.withdrawn ? " (withdrawn)" : ""}</td><td className="px-4 py-3 text-right">{row.capScore}</td><td className="px-4 py-3 text-right">{row.regularWins}</td><td className="px-4 py-3 text-right">{row.totalWins}</td><td className="px-4 py-3 text-right">{row.regularMatches}</td><td className="px-4 py-3 text-right">{row.totalMatches}</td></tr>)}</tbody></table></div>{division.fixtures.length ? <div className="space-y-2 px-4 pb-4 sm:px-6 sm:pb-6"><h3 className="font-medium">Results</h3>{division.fixtures.map(match => <div key={match.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm"><span>{names.get(match.teamAId)} <strong className="mx-2 tabular-nums">{match.scoreA ?? "–"} : {match.scoreB ?? "–"}</strong> {names.get(match.teamBId)}</span>{match.eventId ? <Link className="text-primary hover:underline" href={`/${safeLocale}/matches/${match.eventId}`}>Match statistics</Link> : <span className="text-muted-foreground">Statistics unavailable</span>}</div>)}</div> : null}</CardContent></Card>;
      })}
    </div>
  </PublicPage></PublicSiteShell>;
}
