import { StratmapCreateForm } from "@/components/app/stratmap-create-form"
import { ManagersOnlyState } from "@/components/app/managers-only-state"
import { GameSelectionGate } from "@/components/app/game-selection-gate"
import { clientGrantScopes } from "@/domain/identity/client-grant"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { issueClientGrant } from "@/lib/client-grants"
import { getDictionary } from "@/i18n/dictionaries"
import { isGameId } from "@/domain/games/game"
import { notFound } from "next/navigation"
import { isLocale } from "@/i18n/config"
import { getSession } from "@/lib/auth"

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

    const session = await getSession()
    if (!context || !session) notFound()
    if (!context.canAdmin)
        return (
            <>
                <PageHeader
                    title={dictionary.stratmaps.createTitle}
                    description={dictionary.stratmaps.createDescription}
                />
                <ManagersOnlyState
                    dictionary={dictionary}
                    overviewHref={`/${safeLocale}/dashboard/servers/${serverId}`}
                />
            </>
        )
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
                    grant={issueClientGrant(
                        { discordId: session.sub, sid: session.sid },
                        clientGrantScopes.stratmapCreate(serverId)
                    )}
                    dictionary={dictionary}
                    defaultTitle={dictionary.stratmaps.createTitle}
                    gameId={game}
                />
            </div>
        </>
    )
}
