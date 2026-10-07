import { Map as MapIcon } from "lucide-react"
import { notFound } from "next/navigation"
import Link from "next/link"

import { TablePageLayout } from "@/components/app/table-page-layout"
import { filterByGameScope, isGameId } from "@/domain/games/game"
import { ResourceTable } from "@/components/app/resource-table"
import { listServerStratmaps } from "@/lib/server-stratmaps"
import { PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/app/empty-state"
import { getStratmapMapById } from "@/lib/game-stratmaps"
import { getServerContext } from "@/lib/server-context"
import { parseStratmapState } from "@/lib/stratmaps"
import { getDictionary } from "@/i18n/dictionaries"
import { getPaginatedRows } from "@/lib/data-table"
import { toIntlLocale } from "@/lib/intl-locale"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/format"
import { isLocale } from "@/i18n/config"

export default async function StratmapsPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const { locale, serverId } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const resolvedSearchParams = (await searchParams) ?? {}
    const rawGame = resolvedSearchParams.game
    const requestedGame = Array.isArray(rawGame) ? rawGame[0] : rawGame
    const game = isGameId(requestedGame) ? requestedGame : undefined
    const [stratmapList, context] = await Promise.all([
        listServerStratmaps(serverId),
        getServerContext(serverId),
    ])
    if (!stratmapList || !context) notFound()

    const gameQuery = game ? `?game=${game}` : ""
    const createHref = `/${safeLocale}/dashboard/servers/${serverId}/stratmaps/create${gameQuery}`
    const timezone = context.discordConfig?.timezone
    const intlLocale = toIntlLocale(safeLocale)
    const scoped = filterByGameScope(
        stratmapList.stratmaps,
        game ?? "all"
    ).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    const paginated = getPaginatedRows({
        rows: scoped,
        searchParams: resolvedSearchParams,
        getSearchText: (item) =>
            [
                item.title,
                item.baseMapId,
                getStratmapMapById(item.baseMapId, item.gameId)?.name,
            ]
                .filter(Boolean)
                .join(" "),
    })
    const header = (
        <PageHeader
            title={dictionary.stratmaps.title}
            description={dictionary.stratmaps.pageDescription}
            actions={
                stratmapList.canAdmin && scoped.length ? (
                    <Button asChild className="rounded-xl">
                        <Link href={createHref}>
                            {dictionary.stratmaps.createTitle}
                        </Link>
                    </Button>
                ) : undefined
            }
        />
    )

    if (!scoped.length)
        return (
            <>
                {header}
                <div className="px-4 lg:px-6">
                    <EmptyState
                        icon={MapIcon}
                        title={dictionary.stratmaps.emptyTitle}
                        description={
                            stratmapList.canAdmin
                                ? dictionary.stratmaps.emptyDescription
                                : dictionary.stratmaps.emptyMemberDescription
                        }
                        actions={
                            stratmapList.canAdmin ? (
                                <Button asChild className="rounded-xl">
                                    <Link href={createHref}>
                                        {dictionary.stratmaps.createTitle}
                                    </Link>
                                </Button>
                            ) : undefined
                        }
                    />
                </div>
            </>
        )

    return (
        <TablePageLayout header={header}>
            <ResourceTable
                className="h-full"
                dictionary={dictionary}
                rows={paginated.rows}
                page={paginated.page}
                pageSize={paginated.pageSize}
                pageCount={paginated.pageCount}
                totalRows={paginated.totalRows}
                search={paginated.search}
                searchPlaceholder={dictionary.stratmaps.searchPlaceholder}
                gameColumn={{
                    show: !game,
                    getGameId: (stratmap) => stratmap.gameId,
                }}
                getHref={(row) =>
                    `/${safeLocale}/dashboard/servers/${serverId}/stratmaps/${row.id}${gameQuery}`
                }
                columns={[
                    {
                        key: "title",
                        title: dictionary.stratmaps.tableTitle,
                        render: (row) => row.title,
                    },
                    {
                        key: "map",
                        title: dictionary.stratmaps.tableMap,
                        render: (row) =>
                            getStratmapMapById(row.baseMapId, row.gameId)
                                ?.name ?? row.baseMapId,
                    },
                    {
                        key: "slides",
                        title: dictionary.stratmaps.tableSlides,
                        render: (row) =>
                            parseStratmapState(row.state, row.baseMapId).slides
                                .length,
                    },
                    {
                        key: "updated",
                        title: dictionary.stratmaps.tableUpdated,
                        render: (row) => (
                            <time dateTime={row.updatedAt}>
                                {formatDateTime(
                                    row.updatedAt,
                                    timezone,
                                    intlLocale
                                )}
                            </time>
                        ),
                    },
                ]}
            />
        </TablePageLayout>
    )
}
