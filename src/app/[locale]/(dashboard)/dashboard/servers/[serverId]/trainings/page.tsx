import { connection } from "next/server"
import type { Metadata } from "next"
import { Suspense } from "react"

import { GraduationCap } from "lucide-react"

import { getDiscordChannelNames } from "@/lib/read-models/discord-channel-names"
import { ResourceTable, StatusBadge } from "@/components/app/resource-table"
import { TablePageLayout } from "@/components/app/table-page-layout"
import { PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/app/empty-state"
import { getGuildMetadata } from "@/lib/server-metadata"
import { getServerContext } from "@/lib/server-context"
import { getEventStatusMeta } from "@/lib/event-status"
import { getDictionary } from "@/i18n/dictionaries"
import { getPaginatedRows } from "@/lib/data-table"
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

export const metadata: Metadata = {
    title: "Trainings",
    description: "Training events and registration.",
}

export function generateStaticParams() {
    return [{ locale: "en", serverId: "sample-server" }]
}

export default async function TrainingsPage({
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
    const trainings = events.filter((event) => event.kind === "training")
    const channelNames = trainings.some((event) => event.meetingChannelId)
        ? await getDiscordChannelNames(serverId, context.server.discordId)
        : new Map<string, string>()
    const createHref = `/${locale}/dashboard/servers/${serverId}/trainings/create${typeof game === "string" && isGameId(game) ? `?game=${game}` : ""}`
    const paginated = getPaginatedRows({
        rows: trainings,
        searchParams: resolvedSearchParams,
        getSearchText: (event) =>
            [event.name, event.description, event.status]
                .filter(Boolean)
                .join(" "),
    })

    return (
        <>
            <TablePageLayout
                header={
                    <PageHeader
                        title={dictionary.sidebar.trainings ?? "Trainings"}
                        description={dictionary.event.listDescription}
                        actions={
                            canAdmin ? (
                                <Button asChild className="rounded-xl">
                                    <a href={createHref}>
                                        {dictionary.event.createTrainingAction}
                                    </a>
                                </Button>
                            ) : undefined
                        }
                    />
                }
            >
                {!trainings.length ? (
                    <EmptyState
                        icon={GraduationCap}
                        title={dictionary.matchList.emptyTrainingsTitle}
                        description={
                            canAdmin
                                ? dictionary.matchList.emptyTrainingsAdmin
                                : dictionary.matchList.emptyTrainingsMember
                        }
                        actions={
                            canAdmin ? (
                                <Button asChild className="rounded-xl">
                                    <a href={createHref}>
                                        {dictionary.event.createTrainingAction}
                                    </a>
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
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
                            `/${locale}/dashboard/servers/${serverId}/trainings/${event.id}`
                        }
                        columns={[
                            {
                                key: "name",
                                title: dictionary.tables.event,
                                render: (event) => (
                                    <div className="font-medium">
                                        {event.name}
                                    </div>
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
                                key: "meetingChannelId",
                                title:
                                    dictionary.event.fields.meetingChannelId ??
                                    "Meeting VC",
                                render: (event) =>
                                    event.meetingChannelId
                                        ? channelNames.has(
                                              event.meetingChannelId
                                          )
                                            ? `#${channelNames.get(event.meetingChannelId)}`
                                            : dictionary.matchList
                                                  .unknownChannel
                                        : dictionary.shared.notSet,
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
                )}
            </TablePageLayout>
            <DynamicMetadataMarker />
        </>
    )
}
