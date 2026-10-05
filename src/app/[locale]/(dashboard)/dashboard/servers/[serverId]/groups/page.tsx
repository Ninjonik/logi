import { notFound } from "next/navigation"
import { Users } from "lucide-react"
import type { Metadata } from "next"

import { ManagersOnlyState } from "@/components/app/managers-only-state"
import { TablePageLayout } from "@/components/app/table-page-layout"
import { ResourceTable } from "@/components/app/resource-table"
import { PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/app/empty-state"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { getPaginatedRows } from "@/lib/data-table"
import { Button } from "@/components/ui/button"
import { isGameId } from "@/domain/games/game"
import { Badge } from "@/components/ui/badge"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Groups",
    description: "Manage server groups.",
}

export default async function GroupsPage({
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
    const gameScope = typeof game === "string" && isGameId(game) ? game : "all"
    const context = await getServerContext(serverId, gameScope)
    if (!context) notFound()
    if (!context.canAdmin)
        return (
            <>
                <PageHeader
                    title={dictionary.sidebar.groups}
                    description={dictionary.groups.description}
                />
                <ManagersOnlyState
                    dictionary={dictionary}
                    overviewHref={`/${locale}/dashboard/servers/${serverId}`}
                />
            </>
        )

    const { groups = [], assignments = [], canAdmin } = context
    const createHref = `/${locale}/dashboard/servers/${serverId}/groups/create${gameScope === "all" ? "" : `?game=${gameScope}`}`
    if (!groups.length)
        return (
            <>
                <PageHeader
                    title={dictionary.sidebar.groups}
                    description={dictionary.groups.description}
                />
                <div className="px-4 lg:px-6">
                    <EmptyState
                        icon={Users}
                        title={dictionary.groups.emptyTitle}
                        description={dictionary.groups.emptyDescription}
                        actions={
                            <Button asChild className="rounded-xl">
                                <a href={createHref}>
                                    {dictionary.groups.createTitle}
                                </a>
                            </Button>
                        }
                    />
                </div>
            </>
        )
    const paginated = getPaginatedRows({
        rows: groups,
        searchParams: resolvedSearchParams,
        getSearchText: (group) =>
            [group.name, group.description, group.color]
                .filter(Boolean)
                .join(" "),
    })

    return (
        <TablePageLayout
            header={
                <PageHeader
                    title={dictionary.sidebar.groups}
                    description={dictionary.groups.description}
                    actions={
                        canAdmin ? (
                            <Button asChild className="rounded-xl">
                                <a href={createHref}>
                                    {dictionary.groups.createTitle}
                                </a>
                            </Button>
                        ) : undefined
                    }
                />
            }
        >
            <ResourceTable
                className="h-full"
                dictionary={dictionary}
                rows={paginated.rows}
                page={paginated.page}
                pageSize={paginated.pageSize}
                pageCount={paginated.pageCount}
                totalRows={paginated.totalRows}
                search={paginated.search}
                searchPlaceholder={dictionary.shared.searchTable}
                getHref={(group) =>
                    `/${locale}/dashboard/servers/${serverId}/groups/${group.id}${gameScope === "all" ? "" : `?game=${gameScope}`}`
                }
                gameColumn={{
                    show: gameScope === "all",
                    getGameId: (group) => group.gameId,
                }}
                columns={[
                    {
                        key: "name",
                        title: dictionary.groups.name,
                        render: (group) => (
                            <div className="flex items-center gap-3">
                                <span
                                    className="border-border/60 size-3 rounded-full border"
                                    style={{ backgroundColor: group.color }}
                                />
                                <div className="font-medium">{group.name}</div>
                            </div>
                        ),
                    },
                    {
                        key: "usage",
                        title: dictionary.groups.usedByPlayers,
                        render: (group) =>
                            assignments.filter(
                                (assignment) =>
                                    assignment.primaryGroupId === group.id
                            ).length,
                    },
                    {
                        key: "description",
                        title: dictionary.groups.descriptionLabel,
                        render: (group) =>
                            group.description ? (
                                <span>{group.description}</span>
                            ) : (
                                <Badge variant="secondary">
                                    {dictionary.shared.notSet}
                                </Badge>
                            ),
                    },
                ]}
            />
        </TablePageLayout>
    )
}
