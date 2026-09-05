import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicBreadcrumbs } from "@/components/public/public-breadcrumbs";
import { PublicPage, PublicSiteShell } from "@/components/public/public-site-shell";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getPublicCompetition } from "@/lib/read-models/competitions";

export default async function CompetitionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const labels = dictionary.competition;
  const ecl = await getPublicCompetition("ecl-2026");

  return <PublicSiteShell locale={safeLocale}><PublicPage className="max-w-5xl"><div className="space-y-8">
    <PublicBreadcrumbs items={[{ label: dictionary.app.name, href: `/${safeLocale}` }, { label: labels.title }]} />
    <header><h1 className="text-3xl font-semibold">{labels.title}</h1><p className="mt-2 text-muted-foreground">{labels.description}</p></header>
    {ecl ? <Card className="transition-colors hover:bg-muted/40"><CardHeader className="flex-row items-center gap-4 space-y-0"><div className="flex size-16 items-center justify-center rounded-xl border bg-background p-2"><img src="https://hll-ecl.eu/static/assets/ecl_logo_web_2025.png" alt="ECL" className="max-h-full max-w-full object-contain" /></div><div><CardTitle>{ecl.name} {ecl.season}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{labels.divisions.replace("{count}", String(ecl.divisions.length))}</p></div></CardHeader><CardContent className="flex flex-wrap gap-3"><Link className="text-sm font-medium text-primary hover:underline" href={`/${safeLocale}/competitions/${ecl.slug}`}>{labels.standings} →</Link><a className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" href="https://hll-ecl.eu/rules" target="_blank" rel="noreferrer">{labels.rules} <ExternalLink className="size-3.5" /></a></CardContent></Card> : <p className="text-muted-foreground">{labels.noCompetitions}</p>}
  </div></PublicPage></PublicSiteShell>;
}
