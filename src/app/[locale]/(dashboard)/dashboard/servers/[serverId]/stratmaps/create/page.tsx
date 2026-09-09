import { StratmapCreateForm } from "@/components/app/stratmap-create-form"
import { GameSelectionGate } from "@/components/app/game-selection-gate"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isGameId } from "@/domain/games/game"
import { isLocale } from "@/i18n/config"

export default async function CreateStratmapPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const { game } = await searchParams
    const context = await getServerContext(
        serverId,
        isGameId(game) ? game : "all"
    )

    if (!context?.canAdmin) {
        return null
    }
    if (!isGameId(game))
        return (
            <GameSelectionGate
                enabledGames={context.server.enabledGames}
                dictionary={dictionary}
            />
        )

    return (
        <>
            <PageHeader
                title={dictionary.stratmaps.createTitle}
                description={dictionary.stratmaps.createDescription}
            />
            <div className="px-4 lg:px-6">
                <StratmapCreateForm
                    locale={locale}
                    serverId={serverId}
                    userId={context.user.discordId}
                    dictionary={dictionary}
                    defaultTitle={dictionary.stratmaps.createTitle}
                    gameId={isGameId(game) ? game : undefined}
                />
            </div>
        </>
    )
}
