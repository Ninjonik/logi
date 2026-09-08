import { ExternalLink } from "lucide-react"
import Link from "next/link"

import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PublicBreadcrumbs } from "@/components/public/public-breadcrumbs"
import { getPublicCompetition } from "@/lib/read-models/competitions"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export default async function CompetitionsPage({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const labels = dictionary.competition
    const ecl = await getPublicCompetition("ecl-2026")

    return (
        <PublicSiteShell locale={safeLocale}>
            <PublicPage className="max-w-5xl">
                <div className="space-y-8">
                    <PublicBreadcrumbs
                        items={[
                            {
                                label: dictionary.app.name,
                                href: `/${safeLocale}`,
                            },
                            { label: labels.title },
                        ]}
                    />
                    <header>
                        <h1 className="text-3xl font-semibold">
                            {labels.title}
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            {labels.description}
                        </p>
                    </header>
                    {ecl ? (
                        <Card className="hover:bg-muted/40 transition-colors">
                            <CardHeader className="flex-row items-center gap-4 space-y-0">
                                <div className="bg-background flex size-16 items-center justify-center rounded-xl border p-2">
                                    <img
                                        src="https://hll-ecl.eu/static/assets/ecl_logo_web_2025.png"
                                        alt="ECL"
                                        className="max-h-full max-w-full object-contain"
                                    />
                                </div>
                                <div>
                                    <CardTitle>
                                        {ecl.name} {ecl.season}
                                    </CardTitle>
                                    <p className="text-muted-foreground mt-1 text-sm">
                                        {labels.divisions.replace(
                                            "{count}",
                                            String(ecl.divisions.length)
                                        )}
                                    </p>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-3">
                                <Link
                                    className="text-primary text-sm font-medium hover:underline"
                                    href={`/${safeLocale}/competitions/${ecl.slug}`}
                                >
                                    {labels.standings} →
                                </Link>
                                <a
                                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
                                    href="https://hll-ecl.eu/rules"
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {labels.rules}{" "}
                                    <ExternalLink className="size-3.5" />
                                </a>
                            </CardContent>
                        </Card>
                    ) : (
                        <p className="text-muted-foreground">
                            {labels.noCompetitions}
                        </p>
                    )}
                </div>
            </PublicPage>
        </PublicSiteShell>
    )
}
