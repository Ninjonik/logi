import type { Metadata } from "next"

import {
    DEFAULT_ROSTER_SCORE_SETTINGS,
    summarizeRosterScoreChanges,
} from "@/domain/events/score-policy"
import { SubmitMatchResultsButton } from "@/components/app/submit-match-results-button"
import { MatchDetailPage } from "@/components/app/match-detail/match-detail-page"
import { ConcludeEventButton } from "@/components/app/conclude-event-button"
import { EventFormPanel } from "@/components/app/event-form-panel"
import { PageHeader } from "@/components/app/page-header"
import { GameBadge } from "@/components/app/game-badge"
import { getServerContext } from "@/lib/server-context"
import { getEventStatusMeta } from "@/lib/event-status"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { isGameId } from "@/domain/games/game"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Event",
    description: "View and manage an event.",
}

export function generateStaticParams() {
    return [{ eventId: "sample-event" }]
}

export default async function EventDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string; eventId: string }>
    searchParams: Promise<{ game?: string; tab?: string }>
}) {
    const { locale, serverId, eventId } = await params
    const { game, tab } = await searchParams
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const context = await getServerContext(
        serverId,
        isGameId(game) ? game : "all"
    )
    const found = context?.events.find((item) => item.id === eventId)
    // Matches share the match detail; it also explains a missing match.
    if (!context || !found || found.kind !== "training")
        return (
            <MatchDetailPage
                locale={locale}
                serverId={serverId}
                eventId={eventId}
                game={game}
                tab={tab}
                section="events"
                dictionary={dictionary}
            />
        )
    const {
        rosters,
        canAdmin,
        topicPresets,
        stratmaps,
        discordConfig,
        groups,
    } = context
    const event = found
    const roster = rosters.find((item) => item.eventId === eventId)
    const attachedStratmaps = stratmaps.filter((stratmap) =>
        event.stratmapIds.includes(stratmap.id)
    )
    const closeSummary = summarizeRosterScoreChanges({
        userIds: context.assignments
            .filter((assignment) => !assignment.paused)
            .map((assignment) => assignment.userId),
        settings:
            discordConfig?.membershipSettings?.rosterScoreSettings ??
            DEFAULT_ROSTER_SCORE_SETTINGS,
        participants: event.participants,
        notices: event.absenceNotices,
        roster: roster ?? null,
    })

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
                badge={`${event.cap ? `${event.cap} • ` : ""}${statusMeta?.label}`}
                actions={
                    <div className="flex flex-wrap gap-2">
                        {attachedStratmaps.map((stratmap) => (
                            <Button
                                key={stratmap.id}
                                asChild
                                variant="outline"
                                className="rounded-xl"
                            >
                                <a href={`/${locale}/stratmaps/${stratmap.id}`}>
                                    {stratmap.title}
                                </a>
                            </Button>
                        ))}
                        {roster?.published ? (
                            <Button
                                asChild
                                variant="outline"
                                className="rounded-xl"
                            >
                                <a
                                    href={`/${locale}/dashboard/servers/${serverId}/rosters/${roster.id}`}
                                >
                                    {dictionary.event.showRoster}
                                </a>
                            </Button>
                        ) : null}
                        {event.matchId ? (
                            <Button
                                asChild
                                variant="outline"
                                className="rounded-xl"
                            >
                                <a
                                    href={`/${locale}/dashboard/servers/${serverId}/events/${event.id}/match`}
                                >
                                    {dictionary.event.openMatch}
                                </a>
                            </Button>
                        ) : null}
                        {canAdmin ? (
                            event.status === "concluded" ? (
                                <SubmitMatchResultsButton
                                    serverId={serverId}
                                    eventId={event.id}
                                    gameId={event.gameId ?? "hell_let_loose"}
                                    reviewable={event.kind !== "training"}
                                    dictionary={dictionary}
                                />
                            ) : (
                                <ConcludeEventButton
                                    serverId={serverId}
                                    eventId={event.id}
                                    disabled={false}
                                    dictionary={dictionary}
                                    summary={closeSummary}
                                />
                            )
                        ) : null}
                    </div>
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
