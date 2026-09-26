import { RefreshPerformanceHistoryButton } from "@/components/app/refresh-performance-history-button"
import { MigrateMembershipStatusButton } from "@/components/app/migrate-membership-status-button"
import { LinkMissingDiscordIdsButton } from "@/components/app/link-missing-discord-ids-button"
import { ImportDiscordMembersButton } from "@/components/app/import-discord-members-button"
import { AutoLinkPlatformIdsButton } from "@/components/app/auto-link-platform-ids-button"
import { DedupePlayerStatsButton } from "@/components/app/dedupe-player-stats-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ImportEventsButton } from "@/components/app/import-events-button"
import { DEFAULT_GAME_ID, isGameId } from "@/domain/games/game"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export default async function SystemImportsPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId } = await params
    const { game } = await searchParams
    const gameId = isGameId(game) ? game : DEFAULT_GAME_ID
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const context = await getServerContext(serverId, gameId)
    if (!context?.canAdmin) return null
    const roleId = context.discordConfig?.clanRoleId
    return (
        <>
            <PageHeader
                title={dictionary.clan.importsTitle}
                description={dictionary.clan.importsBody}
            />
            <div className="px-4 lg:px-6">
                <Card className="border-border/60 rounded-2xl">
                    <CardHeader>
                        <CardTitle>{dictionary.clan.importsTitle}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-3">
                        <ImportEventsButton
                            serverId={serverId}
                            dictionary={dictionary}
                            gameId={gameId}
                        />
                        <ImportDiscordMembersButton
                            serverId={serverId}
                            dictionary={dictionary}
                            defaultRoleId={roleId}
                            gameId={gameId}
                        />
                        <AutoLinkPlatformIdsButton
                            serverId={serverId}
                            dictionary={dictionary}
                            gameId={gameId}
                        />
                        <LinkMissingDiscordIdsButton
                            serverId={serverId}
                            dictionary={dictionary}
                            defaultRoleId={roleId}
                            gameId={gameId}
                        />
                        <MigrateMembershipStatusButton
                            serverId={serverId}
                            dictionary={dictionary}
                            defaultRoleId={roleId}
                            gameId={gameId}
                        />
                        <DedupePlayerStatsButton
                            serverId={serverId}
                            dictionary={dictionary}
                            gameId={gameId}
                        />
                        <RefreshPerformanceHistoryButton
                            serverId={serverId}
                            dictionary={dictionary}
                            gameId={gameId}
                        />
                    </CardContent>
                </Card>
            </div>
        </>
    )
}
