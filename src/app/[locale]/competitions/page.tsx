import type { Metadata } from "next"

import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { PublicCompetitionList } from "@/components/public/public-competition-list"
import { listPublicCompetitions } from "@/lib/read-models/competitions"
import { getDictionary } from "@/i18n/dictionaries"
import { getLocalizedCanonical } from "@/lib/seo"
import { isLocale } from "@/i18n/config"

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
    const competitions = (await listPublicCompetitions()).sort(
        (a, b) =>
            b.season.localeCompare(a.season, undefined, { numeric: true }) ||
            a.name.localeCompare(b.name)
    )

    return (
        <PublicSiteShell locale={safeLocale} current="competitions">
            <PublicPage>
                <PublicCompetitionList
                    competitions={competitions}
                    locale={safeLocale}
                    dictionary={getDictionary(safeLocale)}
                />
            </PublicPage>
        </PublicSiteShell>
    )
}
