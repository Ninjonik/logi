import Link from "next/link"

import { filterByGameScope, isGameId } from "@/domain/games/game"
import { ResourceTable } from "@/components/app/resource-table"
import { listServerStratmaps } from "@/lib/server-stratmaps"
import { PageHeader } from "@/components/app/page-header"
import { getStratmapMapById } from "@/lib/game-stratmaps"
import { parseStratmapState } from "@/lib/stratmaps"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"

export default async function StratmapsPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams?: Promise<{ search?: string; page?: string; game?: string }>
}) {
    const { locale, serverId } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const { search = "", page = "1", game } = (await searchParams) ?? {}
    const stratmapList = await listServerStratmaps(serverId)
    if (!stratmapList) {
        return null
    }

    const normalizedSearch = search.trim().toLowerCase()
    const gameQuery = isGameId(game) ? `?game=${game}` : ""
    const rows = filterByGameScope(
        stratmapList.stratmaps,
        isGameId(game) ? game : "all"
    )
        .filter(
            (item) =>
                !normalizedSearch ||
                item.title.toLowerCase().includes(normalizedSearch) ||
                item.baseMapId.includes(normalizedSearch)
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

    return (
        <>
            <PageHeader
                title={dictionary.stratmaps.title}
                description={dictionary.stratmaps.pageDescription}
                actions={
                    stratmapList.canAdmin ? (
                        <Button asChild className="rounded-xl">
                            <Link
                                href={`/${locale}/dashboard/servers/${serverId}/stratmaps/create${gameQuery}`}
                            >
                                {dictionary.stratmaps.createTitle}
                            </Link>
                        </Button>
                    ) : undefined
                }
            />
            <div className="px-4 lg:px-6">
                <ResourceTable
                    dictionary={dictionary}
                    page={Number(page) || 1}
                    pageSize={rows.length || 1}
                    pageCount={1}
                    totalRows={rows.length}
                    search={search}
                    searchPlaceholder={dictionary.stratmaps.searchPlaceholder}
                    rows={rows}
                    gameColumn={{
                        show: !isGameId(game),
                        getGameId: (stratmap) => stratmap.gameId,
                    }}
                    getHref={(row) =>
                        `/${locale}/dashboard/servers/${serverId}/stratmaps/${row.id}${gameQuery}`
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
                                parseStratmapState(row.state, row.baseMapId)
                                    .slides.length,
                        },
                        {
                            key: "updated",
                            title: dictionary.stratmaps.tableUpdated,
                            render: (row) =>
                                new Date(row.updatedAt).toLocaleString(),
                        },
                    ]}
                />
            </div>
        </>
    )
}
