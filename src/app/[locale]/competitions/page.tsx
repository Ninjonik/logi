import { ExternalLink } from "lucide-react"
import Link from "next/link"

import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PublicBreadcrumbs } from "@/components/public/public-breadcrumbs"
import { listPublicCompetitions } from "@/lib/read-models/competitions"
import { GameBadge } from "@/components/app/game-badge"
import { getDictionary } from "@/i18n/dictionaries"
import { GAME_LABELS } from "@/domain/games/game"
import { getLocalizedCanonical } from "@/lib/seo"
import { pluralize } from "@/i18n/plural"
import { isLocale } from "@/i18n/config"
import type { Metadata } from "next"

const ECL_SLUG = "ecl-2026"
const ECL_LOGO = "https://hll-ecl.eu/static/assets/ecl_logo_web_2025.png"

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>
}): Promise<Metadata> {
    const { locale } = (await params) ?? { locale: "en" }
    const safeLocale = isLocale(locale) ? locale : "en"
    return {
        title: "Hell Let Loose and Wardogs competitions and standings",
        description:
            "Follow Hell Let Loose and Wardogs competition standings, teams, fixtures, and match results.",
        alternates: getLocalizedCanonical(safeLocale, "/competitions"),
    }
}

export default async function CompetitionsPage({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const labels = dictionary.competition
    const competitions = (await listPublicCompetitions()).sort(
        (a, b) =>
            b.season.localeCompare(a.season, undefined, { numeric: true }) ||
            a.name.localeCompare(b.name)
    )

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
                    {competitions.length ? (
                        <div className="space-y-4">
                            {competitions.map((competition) => (
                                <Card
                                    key={competition.id}
                                    className="hover:bg-muted/40 transition-colors"
                                >
                                    <CardHeader className="flex-row items-center gap-4 space-y-0">
                                        {competition.slug === ECL_SLUG ? (
                                            <div className="bg-background flex size-16 shrink-0 items-center justify-center rounded-xl border p-2">
                                                <img
                                                    src={ECL_LOGO}
                                                    alt="ECL"
                                                    className="max-h-full max-w-full object-contain"
                                                />
                                            </div>
                                        ) : null}
                                        <div>
                                            <CardTitle>
                                                {competition.name}{" "}
                                                {competition.season}
                                            </CardTitle>
                                            <p className="text-muted-foreground mt-1 text-sm">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <GameBadge
                                                        gameId={
                                                            competition.gameId
                                                        }
                                                        dictionary={dictionary}
                                                    />
                                                    {
                                                        GAME_LABELS[
                                                            competition.gameId
                                                        ]
                                                    }{" "}
                                                    ·{" "}
                                                    {pluralize(
                                                        safeLocale,
                                                        competition.divisions
                                                            .length,
                                                        labels.divisions
                                                    )}
                                                </span>
                                            </p>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex flex-wrap gap-3">
                                        <Link
                                            className="text-primary text-sm font-medium hover:underline"
                                            href={`/${safeLocale}/competitions/${competition.slug}`}
                                        >
                                            {labels.standings} →
                                        </Link>
                                        {competition.slug === ECL_SLUG ? (
                                            <a
                                                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
                                                href="https://hll-ecl.eu/rules"
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                {labels.rules}{" "}
                                                <ExternalLink className="size-3.5" />
                                            </a>
                                        ) : null}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
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
