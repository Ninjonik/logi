import { LeagueJoinPage } from "@/components/leagues/league-join-page"
import { getLeagueMessages } from "@/i18n/messages/leagues"
import { isLocale } from "@/i18n/config"
export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const locale = (await params)?.locale
    return {
        title: getLeagueMessages(isLocale(locale) ? locale : "en").accountTitle,
        robots: { index: false, follow: false },
    }
}
export default async function JoinPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>
    searchParams: Promise<{ invite?: string }>
}) {
    const [{ locale }, { invite }] = await Promise.all([params, searchParams])
    return (
        <LeagueJoinPage
            locale={isLocale(locale) ? locale : "en"}
            competition={null}
            invite={
                typeof invite === "string" && /^[a-f0-9]{32}$/.test(invite)
                    ? invite
                    : undefined
            }
        />
    )
}
