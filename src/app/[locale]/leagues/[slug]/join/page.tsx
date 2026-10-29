import { LeagueJoinPage } from "@/components/leagues/league-join-page"
import { getPublicCompetition } from "@/lib/read-models/competitions"
import { getLeagueMessages } from "@/i18n/messages/leagues"
import { notFound } from "next/navigation"
import { isLocale } from "@/i18n/config"
export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const locale = (await params)?.locale
    return {
        title: getLeagueMessages(isLocale(locale) ? locale : "en").joinTitle,
        robots: { index: false, follow: false },
    }
}
export default async function JoinLeaguePage({
    params,
}: {
    params: Promise<{ locale: string; slug: string }>
}) {
    const { locale, slug } = await params
    const competition = await getPublicCompetition(slug)
    if (!competition) notFound()
    return (
        <LeagueJoinPage
            locale={isLocale(locale) ? locale : "en"}
            competition={competition}
        />
    )
}
