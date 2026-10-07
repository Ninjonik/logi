import { NewMatchPage } from "@/components/app/new-match/new-match-page"

/** New match (design D2); `?draftId=` resumes a saved draft. */
export default async function CreateMatchPage({
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
