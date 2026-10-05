import { notFound } from "next/navigation"
import type { Metadata } from "next"

import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { PublicCompetitionView } from "@/components/public/public-competition-view"
import { getCompetitionClanLinks } from "@/lib/read-models/public-clan-page"
import { selectCompetitionView } from "@/domain/competitions/public-rounds"
import { getPublicCompetition } from "@/lib/read-models/competitions"
import { getDictionary } from "@/i18n/dictionaries"
import { getLocalizedCanonical } from "@/lib/seo"
import { requestTime } from "@/lib/request-time"
import { isLocale } from "@/i18n/config"

type Props = {
    params: Promise<{ locale: string; slug: string }>
    searchParams: Promise<{ division?: string | string[] }>
}

export async function generateMetadata({
    params,
}: Pick<Props, "params">): Promise<Metadata> {
    const { locale, slug } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const competition = await getPublicCompetition(slug)
    return {
        title: competition
            ? `${competition.name} ${competition.season}`
            : "Competition",
        description: competition
            ? `${competition.name} standings and match results.`
            : "Competition standings.",
        alternates: getLocalizedCanonical(safeLocale, `/competitions/${slug}`),
    }
}

export default async function CompetitionPage({ params, searchParams }: Props) {
    const [{ locale, slug }, { division: requested }] = await Promise.all([
        params,
        searchParams,
    ])
    const safeLocale = isLocale(locale) ? locale : "en"
    const competition = await getPublicCompetition(slug)
    if (!competition) notFound()
    const clanLinks = await getCompetitionClanLinks(competition.slug)

    return (
        <PublicSiteShell locale={safeLocale} current="competitions">
            <PublicPage>
                <PublicCompetitionView
                    competition={competition}
                    view={selectCompetitionView(
                        competition.divisions,
                        typeof requested === "string" ? requested : undefined
                    )}
                    clanLinks={clanLinks}
                    now={requestTime()}
                    locale={safeLocale}
                    dictionary={getDictionary(safeLocale)}
                />
            </PublicPage>
        </PublicSiteShell>
    )
}
