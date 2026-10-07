import { NewMatchPage } from "@/components/app/new-match/new-match-page"

/** New event: the same flow as a new match (design D2). */
export default async function CreateEventPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ game?: string; draftId?: string }>
}) {
    const { locale, serverId } = await params
    const { game, draftId } = await searchParams
    return (
        <NewMatchPage
            locale={locale}
            serverId={serverId}
            kind="match"
            game={game}
            draftId={draftId}
        />
    )
}
