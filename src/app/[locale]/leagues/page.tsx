import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { LeagueDirectory } from "@/components/leagues/league-directory"
import { listPublicCompetitions } from "@/lib/read-models/competitions"
import { getLeagueMessages } from "@/i18n/messages/leagues"
import { getLocalizedCanonical } from "@/lib/seo"
import { isLocale } from "@/i18n/config"
import type { Metadata } from "next"
export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>
}): Promise<Metadata> {
    const locale = (await params)?.locale
    const safe = isLocale(locale) ? locale : "en"
    const t = getLeagueMessages(safe)
    return {
        title: t.title,
        description: t.description,
        alternates: getLocalizedCanonical(safe, "/leagues"),
    }
}
export default async function LeaguesPage({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    const safe = isLocale(locale) ? locale : "en"
    const competitions = (await listPublicCompetitions()).sort(
        (a, b) =>
            b.season.localeCompare(a.season, undefined, { numeric: true }) ||
            a.name.localeCompare(b.name)
    )
    return (
        <PublicSiteShell locale={safe} current="leagues">
            <PublicPage>
                <LeagueDirectory competitions={competitions} locale={safe} />
            </PublicPage>
        </PublicSiteShell>
    )
}
