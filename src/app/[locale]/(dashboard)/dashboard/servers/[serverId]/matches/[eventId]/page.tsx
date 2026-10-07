import { MatchDetailPage } from "@/components/app/match-detail/match-detail-page"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export default async function MatchDetailRoute({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string; eventId: string }>
    searchParams: Promise<{ game?: string; tab?: string }>
}) {
    const { locale, serverId, eventId } = await params
    const { game, tab } = await searchParams
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")

    return (
        <MatchDetailPage
            locale={locale}
            serverId={serverId}
            eventId={eventId}
            game={game}
            tab={tab}
            section="matches"
            dictionary={dictionary}
        />
    )
}
