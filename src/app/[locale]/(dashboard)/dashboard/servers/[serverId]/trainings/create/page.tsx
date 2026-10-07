import { NewMatchPage } from "@/components/app/new-match/new-match-page"

/** New training: the new-match flow with a training template (design D2). */
export default async function CreateTrainingPage({
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
            kind="training"
            game={game}
            draftId={draftId}
        />
    )
}
