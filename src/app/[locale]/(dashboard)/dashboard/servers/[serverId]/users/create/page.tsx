import type { Metadata } from "next"

import { UserAssignmentForm } from "@/components/app/user-assignment-form"
import { GameSelectionGate } from "@/components/app/game-selection-gate"
import { getEligibleUsersForServer } from "@/lib/server-user-management"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isGameId } from "@/domain/games/game"
import { isLocale } from "@/i18n/config"

export default async function CreateServerUserPage({
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
    const gameId = isGameId(game) ? game : undefined
    const context = await getServerContext(serverId, gameId ?? "all")
    if (!context?.canAdmin) return null
    if (!gameId)
        return (
            <GameSelectionGate
                enabledGames={context.server.enabledGames}
                dictionary={dictionary}
            />
        )
    const { server, groups = [], assignments } = context

    const eligibleUsers = await getEligibleUsersForServer(server, assignments)

    return (
        <>
            <PageHeader
                title={dictionary.userManagement.addPlayer}
                description={dictionary.userManagement.description}
            />
            <div className="px-4 lg:px-6">
                <UserAssignmentForm
                    locale={safeLocale}
                    server={server}
                    dictionary={dictionary}
                    eligibleUsers={eligibleUsers}
                    groups={groups}
                    config={context.discordConfig}
                    canManage
                    createMode
                    gameId={gameId}
                />
            </div>
        </>
    )
}
