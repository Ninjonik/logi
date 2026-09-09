import { connection } from "next/server"
import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"

import { ResourceTable, StatusBadge } from "@/components/app/resource-table"
import { TablePageLayout } from "@/components/app/table-page-layout"
import { formatHllPresetLabel } from "@/lib/hll-map-presets"
import { PageHeader } from "@/components/app/page-header"
import { getGuildMetadata } from "@/lib/server-metadata"
import { getServerContext } from "@/lib/server-context"
import { getEventStatusMeta } from "@/lib/event-status"
import { getDictionary } from "@/i18n/dictionaries"
import { getPaginatedRows } from "@/lib/data-table"
import type { EventRecord } from "@/types/domain"
import { Button } from "@/components/ui/button"
import { isGameId } from "@/domain/games/game"
import { formatDateTime } from "@/lib/format"
import { isLocale } from "@/i18n/config"

async function ConnectionMarker() {
    await connection()
    return null
}

async function DynamicMetadataMarker() {
    return (
        <Suspense>
            <ConnectionMarker />
        </Suspense>
    )
}

function getEventResultLabel(
    event: EventRecord,
    dictionary: ReturnType<typeof getDictionary>
) {
    if (!event.eventResult) {
        return dictionary.shared.notSet
    }

    const outcomeLabel =
        event.eventResult.outcome === "victory"
            ? dictionary.event.resultVictory
            : event.eventResult.outcome === "defeat"
              ? dictionary.event.resultDefeat
              : dictionary.event.resultDraw

    return `${outcomeLabel} ${event.eventResult.score.sideA}-${event.eventResult.score.sideB}`
}

export const metadata: Metadata = {
    title: "Matches | Logi",
    description: "Matches, results, and registration.",
}

export default async function MatchesPage({
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
    const context = await getServerContext(
        serverId,
        typeof game === "string" && isGameId(game) ? game : "all"
    )
    if (!context) return null
    const { events, canAdmin, discordConfig } = context
    const matches = events
        .filter((event) => event.kind === "match")
        .sort(
            (left, right) =>
                new Date(right.meetingStart).getTime() -
                new Date(left.meetingStart).getTime()
        )
    const paginated = getPaginatedRows({
        rows: matches,
        searchParams: resolvedSearchParams,
        getSearchText: (event) =>
            [
                event.name,
                event.map,
                event.side,
                event.status,
                event.matchStatsId,
                event.eventResult?.outcome,
            ]
                .filter(Boolean)
                .join(" "),
    })

    return (
        <>
            <TablePageLayout
                header={
                    <PageHeader
                        title={dictionary.sidebar.matches ?? "Matches"}
                        description={dictionary.event.listDescription}
                        actions={
                            canAdmin ? (
                                <div className="flex flex-wrap gap-2">
                                    <Button asChild className="rounded-xl">
                                        <a
                                            href={`/${locale}/dashboard/servers/${serverId}/matches/create${typeof game === "string" && isGameId(game) ? `?game=${game}` : ""}`}
                                        >
                                            {dictionary.common.createEvent}
                                        </a>
                                    </Button>
                                    <Button
                                        asChild
                                        variant="outline"
                                        className="rounded-xl"
                                    >
                                        <a
                                            href={`/${locale}/dashboard/servers/${serverId}/matches/recurring`}
                                        >
                                            {dictionary.event.recurringMatches}
                                        </a>
                                    </Button>
                                </div>
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
                    gameColumn={{
                        show: !(typeof game === "string" && isGameId(game)),
                        getGameId: (event) => event.gameId,
                    }}
                    getHref={(event) =>
                        `/${locale}/dashboard/servers/${serverId}/matches/${event.id}`
                    }
                    columns={[
                        {
                            key: "name",
                            title: dictionary.tables.event,
                            render: (event) => (
                                <div className="font-medium">{event.name}</div>
                            ),
                        },
                        {
                            key: "meetingStart",
                            title: dictionary.tables.meeting,
                            render: (event) =>
                                formatDateTime(
                                    event.meetingStart,
                                    discordConfig?.timezone
                                ),
                        },
                        {
                            key: "map",
                            title: dictionary.calendarCards.map,
                            render: (event) =>
                                `${formatHllPresetLabel(event.map) ?? event.map ?? "TBD"} • ${event.side ?? "TBD"}`,
                        },
                        {
                            key: "result",
                            title: dictionary.event.resultColumn,
                            render: (event) => (
                                <div className="font-medium">
                                    {getEventResultLabel(event, dictionary)}
                                </div>
                            ),
                        },
                        {
                            key: "match",
                            title: dictionary.event.matchColumn,
                            render: (event) =>
                                event.matchStatsId ? (
                                    <Link
                                        href={`/${locale}/dashboard/servers/${serverId}/matches/${event.id}/match-stats`}
                                        className="text-primary font-medium underline-offset-4 hover:underline"
                                    >
                                        #{event.matchStatsId.slice(-6)}
                                    </Link>
                                ) : (
                                    <span className="text-muted-foreground">
                                        {dictionary.shared.notSet}
                                    </span>
                                ),
                        },
                        {
                            key: "status",
                            title: dictionary.tables.status,
                            render: (event) => {
                                const meta = getEventStatusMeta(
                                    event.status,
                                    dictionary
                                )
                                return (
                                    <StatusBadge
                                        active={meta?.active}
                                        activeLabel={meta.label}
                                        inactiveLabel={meta.label}
                                    />
                                )
                            },
                        },
                    ]}
                />
            </TablePageLayout>
            <DynamicMetadataMarker />
        </>
    )
}
