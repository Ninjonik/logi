import { PlayerTrendIndicators } from "@/components/app/player-trend-indicators"
import type { PerformanceSnapshot } from "@/lib/read-models/performance-history"
import { ResourceTable, StatusBadge } from "@/components/app/resource-table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PlatformIdList } from "@/components/app/platform-id-display"
import type { Dictionary } from "@/i18n/dictionaries"
export type PlayerTableRow = {
    id: string
    gameId?: string
    name: string
    avatar: string
    discordId: string
    platformIds: string[]
    type: string
    group: string
    score: string | number
    status: string
    active: boolean
    matches: PerformanceSnapshot[]
    href: string
}
/** Shared rendering for live clan players and the isolated onboarding fixtures. */
export function PlayersTable({
    rows,
    dictionary,
    locale,
    page,
    pageSize,
    pageCount,
    totalRows,
    search,
    showGame,
}: {
    rows: PlayerTableRow[]
    dictionary: Dictionary
    locale: string
    page: number
    pageSize: number
    pageCount: number
    totalRows: number
    search: string
    showGame: boolean
}) {
    return (
        <ResourceTable
            className="h-full"
            dictionary={dictionary}
            rows={rows}
            page={page}
            pageSize={pageSize}
            pageCount={pageCount}
            totalRows={totalRows}
            search={search}
            searchPlaceholder={dictionary.userManagement.searchPlaceholder}
            gameColumn={{ show: showGame, getGameId: (row) => row.gameId }}
            getHref={(row) => row.href}
            columns={[
                {
                    key: "player",
                    title: dictionary.userManagement.tablePlayer,
                    render: (row) => (
                        <div className="flex items-center gap-3">
                            <Avatar className="size-9 rounded-lg">
                                <AvatarImage src={row.avatar} alt={row.name} />
                                <AvatarFallback>
                                    {row.name.slice(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="font-medium">{row.name}</div>
                                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                                    <span>{row.discordId}</span>
                                    {row.platformIds.length ? (
                                        <PlatformIdList
                                            platformIds={row.platformIds}
                                            dictionary={dictionary}
                                            compact
                                        />
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    ),
                },
                {
                    key: "type",
                    title: dictionary.userManagement.tableType,
                    render: (row) => row.type,
                },
                {
                    key: "group",
                    title: dictionary.userManagement.tableGroup,
                    render: (row) => row.group,
                },
                {
                    key: "score",
                    title: dictionary.userManagement.tableScore,
                    render: (row) => row.score,
                },
                {
                    key: "trends",
                    title: dictionary.clan.playerPerformanceTrend,
                    render: (row) => (
                        <PlayerTrendIndicators
                            matches={row.matches}
                            dictionary={dictionary}
                            locale={locale}
                        />
                    ),
                },
                {
                    key: "status",
                    title: dictionary.userManagement.tableStatus,
                    render: (row) => (
                        <StatusBadge
                            active={row.active}
                            activeLabel={row.status}
                            inactiveLabel={row.status}
                        />
                    ),
                },
            ]}
        />
    )
}
