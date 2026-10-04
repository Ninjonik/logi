import { SquadPresetEditor } from "@/components/app/squad-preset-editor"
import { GameSelectionGate } from "@/components/app/game-selection-gate"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isGameId } from "@/domain/games/game"
import { isLocale } from "@/i18n/config"

export default async function CreateSquadPresetPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId } = await params
    const { game } = await searchParams
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const gameId = isGameId(game) ? game : undefined
    const context = await getServerContext(serverId, gameId ?? "all")
    const canAdmin = context?.canAdmin ?? false
    const groups = context?.groups ?? []

    if (!gameId) {
        return (
            <GameSelectionGate
                enabledGames={context?.server.enabledGames}
                dictionary={dictionary}
            />
        )
    }

    return (
        <>
            <PageHeader
                title={dictionary.presets.createSquadTitle}
                description={dictionary.presets.createSquadDescription}
            />
            <div className="px-4 lg:px-6">
                <SquadPresetEditor
                    name=""
                    squads={[]}
                    groups={groups}
                    canEdit={canAdmin}
                    dictionary={dictionary}
                    serverId={serverId}
                    locale={locale}
                    gameId={gameId}
                    startInEditMode
                />
            </div>
        </>
    )
}
