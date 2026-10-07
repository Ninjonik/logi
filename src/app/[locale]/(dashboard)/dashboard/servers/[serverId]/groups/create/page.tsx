import { ManagersOnlyState } from "@/components/app/managers-only-state"
import { GameSelectionGate } from "@/components/app/game-selection-gate"
import { PageHeader } from "@/components/app/page-header"
import { GroupForm } from "@/components/app/group-form"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isGameId } from "@/domain/games/game"
import { notFound } from "next/navigation"
import { isLocale } from "@/i18n/config"

export default async function CreateGroupPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const { locale, serverId } = await params
    const resolvedSearchParams = await searchParams
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const game = resolvedSearchParams?.game
    const selectedGame =
        typeof game === "string" && isGameId(game) ? game : null
    const context = await getServerContext(serverId, selectedGame ?? "all")
    if (!context) notFound()

    return (
        <>
            <PageHeader
                title={dictionary.groups.createTitle}
                description={dictionary.groups.createDescription}
            />
            {!context.canAdmin ? (
                <ManagersOnlyState
                    dictionary={dictionary}
                    overviewHref={`/${locale}/dashboard/servers/${serverId}`}
                />
            ) : selectedGame ? (
                <div className="px-4 lg:px-6">
                    <GroupForm
                        serverId={serverId}
                        locale={locale}
                        dictionary={dictionary}
                        canEdit={context.canAdmin}
                        createMode
                        gameId={selectedGame}
                        availableGroups={context.groups ?? []}
                    />
                </div>
            ) : (
                // Choose the game first; the form appears once one is picked.
                <GameSelectionGate
                    enabledGames={context.server.enabledGames}
                    dictionary={dictionary}
                />
            )}
        </>
    )
}
