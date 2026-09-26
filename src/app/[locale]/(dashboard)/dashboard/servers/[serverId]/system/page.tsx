import { SystemMaintenanceSections } from "@/components/app/system-maintenance-sections"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ApiKeyManager } from "@/components/app/api-key-manager"
import { DEFAULT_GAME_ID, isGameId } from "@/domain/games/game"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export default async function SystemPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId } = await params
    const { game } = await searchParams
    const gameId = isGameId(game) ? game : DEFAULT_GAME_ID
    const context = await getServerContext(serverId, gameId)
    if (!context?.canAdmin) return null
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    return (
        <>
            <PageHeader
                title={dictionary.clan.systemTitle}
                description={dictionary.clan.systemBody}
            />
            <div className="space-y-6 px-4 lg:px-6">
                <Card className="border-border/60 rounded-2xl">
                    <CardHeader>
                        <CardTitle>{dictionary.clan.websiteApi}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ApiKeyManager serverId={serverId} />
                    </CardContent>
                </Card>
                <SystemMaintenanceSections
                    serverId={serverId}
                    gameId={gameId}
                    defaultRoleId={context.discordConfig?.clanRoleId}
                    dictionary={dictionary}
                />
            </div>
        </>
    )
}
