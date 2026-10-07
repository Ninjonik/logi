import { RefreshPerformanceHistoryButton } from "@/components/app/refresh-performance-history-button"
import { MigrateMembershipStatusButton } from "@/components/app/migrate-membership-status-button"
import { LinkMissingDiscordIdsButton } from "@/components/app/link-missing-discord-ids-button"
import { ImportDiscordMembersButton } from "@/components/app/import-discord-members-button"
import { AutoLinkPlatformIdsButton } from "@/components/app/auto-link-platform-ids-button"
import { DedupePlayerStatsButton } from "@/components/app/dedupe-player-stats-button"
import { ImportEventsButton } from "@/components/app/import-events-button"
import { DEFAULT_GAME_ID, type GameId } from "@/domain/games/game"
import { Card, CardContent } from "@/components/ui/card"
import type { Dictionary } from "@/i18n/dictionaries"

/** One-off imports and data repairs for the selected game; Hell Let Loose has extra stats tools. */
export function MaintenanceImports({
    serverId,
    gameId,
    enabledGames,
    defaultRoleId,
    dictionary,
}: {
    serverId: string
    gameId: GameId
    enabledGames?: GameId[]
    defaultRoleId?: string
    dictionary: Dictionary
}) {
    const isHellLetLoose = gameId === DEFAULT_GAME_ID
    return (
        <Card className="border-border/60 rounded-2xl">
            <CardContent className="space-y-3">
                <p className="text-muted-foreground text-sm">
                    {dictionary.clan.importsBody}
                </p>
                <div className="flex flex-wrap gap-3">
                    {isHellLetLoose ? (
                        <ImportEventsButton
                            serverId={serverId}
                            dictionary={dictionary}
                            gameId={gameId}
                        />
                    ) : null}
                    <ImportDiscordMembersButton
                        serverId={serverId}
                        dictionary={dictionary}
                        defaultRoleId={defaultRoleId}
                        gameId={gameId}
                        enabledGames={enabledGames}
                    />
                    {isHellLetLoose ? (
                        <AutoLinkPlatformIdsButton
                            serverId={serverId}
                            dictionary={dictionary}
                            gameId={gameId}
                        />
                    ) : null}
                    <LinkMissingDiscordIdsButton
                        serverId={serverId}
                        dictionary={dictionary}
                        defaultRoleId={defaultRoleId}
                        gameId={gameId}
                    />
                    <MigrateMembershipStatusButton
                        serverId={serverId}
                        dictionary={dictionary}
                        defaultRoleId={defaultRoleId}
                        gameId={gameId}
                    />
                    {isHellLetLoose ? (
                        <DedupePlayerStatsButton
                            serverId={serverId}
                            dictionary={dictionary}
                            gameId={gameId}
                        />
                    ) : null}
                    <RefreshPerformanceHistoryButton
                        serverId={serverId}
                        dictionary={dictionary}
                        gameId={gameId}
                    />
                </div>
            </CardContent>
        </Card>
    )
}
