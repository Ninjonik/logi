import { CompleteTrainingButton } from "@/components/app/complete-training-button"
import { EventFormPanel } from "@/components/app/event-form-panel"
import { getUsersByIds } from "@/lib/server-user-management"
import { PageHeader } from "@/components/app/page-header"
import { GameBadge } from "@/components/app/game-badge"
import { getServerContext } from "@/lib/server-context"
import { getEventStatusMeta } from "@/lib/event-status"
import { getDictionary } from "@/i18n/dictionaries"
import { isGameId } from "@/domain/games/game"
import { isLocale } from "@/i18n/config"

export default async function TrainingDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string; eventId: string }>
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId, eventId } = await params
    const { game } = await searchParams
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const context = await getServerContext(
        serverId,
        isGameId(game) ? game : "all"
    )
    if (!context) return null
    const { events, canAdmin, topicPresets, stratmaps, discordConfig, groups } =
        context
    const event = events.find(
        (item) => item.id === eventId && item.kind === "training"
    )
    if (!event) return null
    const attendingParticipants = event.participants.filter(
        (participant) => participant.status === "attending"
    )
    const users = await getUsersByIds(
        attendingParticipants.map((participant) => participant.userId),
        context.server.discordId
    )
    const userByDiscordId = new Map(users.map((user) => [user.discordId, user]))
    const attendees = attendingParticipants.map((participant) => ({
        userId: participant.userId,
        label:
            userByDiscordId.get(participant.userId)?.name ?? participant.userId,
        completed: participant.completed,
    }))

    const statusMeta = getEventStatusMeta(event.status, dictionary)

    return (
        <>
            <PageHeader
                title={event.name}
                description={event.description}
                badges={
                    !isGameId(game) ? (
                        <GameBadge
                            gameId={event.gameId}
                            dictionary={dictionary}
                        />
                    ) : undefined
                }
                badge={statusMeta?.label}
                actions={
                    canAdmin && event.status !== "concluded" ? (
                        <CompleteTrainingButton
                            serverId={serverId}
                            eventId={event.id}
                            disabled={false}
                            dictionary={dictionary}
                            attendees={attendees}
                        />
                    ) : undefined
                }
            />
            <div className="px-4 lg:px-6">
                <EventFormPanel
                    event={event}
                    serverId={serverId}
                    locale={locale}
                    topicPresets={topicPresets}
                    stratmaps={stratmaps}
                    groups={groups}
                    eventCategories={context.server.eventCategories ?? []}
                    timezone={discordConfig?.timezone ?? "UTC"}
                    canEdit={canAdmin}
                    dictionary={dictionary}
                    createMode={false}
                    discordConfig={discordConfig}
                />
            </div>
        </>
    )
}
