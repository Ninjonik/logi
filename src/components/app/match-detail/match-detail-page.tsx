import { ClipboardList, SearchX } from "lucide-react"
import Link from "next/link"

import {
    isMatchDetailTab,
    MatchDetailHeader,
    type MatchDetailTab,
} from "@/components/app/match-detail/match-detail-header"
import {
    discordUrl,
    getEventDiscordMessages,
    getEventResultReview,
} from "@/lib/read-models/match-detail"
import {
    DEFAULT_ROSTER_SCORE_SETTINGS,
    summarizeRosterScoreChanges,
} from "@/domain/events/score-policy"
import {
    deriveMatchPhases,
    type MatchResultState,
} from "@/domain/events/match-phase"
import { MatchAttendancePanel } from "@/components/app/match-detail/match-attendance-panel"
import { SubmitMatchResultsButton } from "@/components/app/submit-match-results-button"
import { MatchDiscordPanel } from "@/components/app/match-detail/match-discord-panel"
import { ConcludeEventButton } from "@/components/app/conclude-event-button"
import { LiveRosterBoard } from "@/components/app/live-roster-board"
import { EventFormPanel } from "@/components/app/event-form-panel"
import { clientGrantScopes } from "@/domain/identity/client-grant"
import { ResultReview } from "@/components/app/result-review"
import { getUsersByIds } from "@/lib/server-user-management"
import { isGameId, type GameId } from "@/domain/games/game"
import { EmptyState } from "@/components/app/empty-state"
import { getServerContext } from "@/lib/server-context"
import { issueClientGrant } from "@/lib/client-grants"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { getSession } from "@/lib/auth"

/**
 * The match detail (designs D3, E2, E3): one header with progress and tabs,
 * and the selected section below it. Used by the match and the event detail
 * routes, which differ only in their URLs.
 */
export async function MatchDetailPage({
    locale,
    serverId,
    eventId,
    game,
    tab,
    section,
    dictionary,
}: {
    locale: string
    serverId: string
    eventId: string
    game?: string
    tab?: string
    /** The route the page lives under: `matches` or `events`. */
    section: "matches" | "events"
    dictionary: Dictionary
}) {
    const gameScope = isGameId(game) ? game : "all"
    const listHref = `/${locale}/dashboard/servers/${serverId}/${section}${isGameId(game) ? `?game=${game}` : ""}`
    const [context, session] = await Promise.all([
        getServerContext(serverId, gameScope),
        getSession(),
    ])
    const event = context?.events.find(
        (item) => item.id === eventId && (item.kind ?? "match") === "match"
    )
    if (!context || !event || !session) {
        return (
            <div className="px-4 lg:px-6">
                <EmptyState
                    icon={SearchX}
                    title={dictionary.matchDetail.notFoundTitle}
                    description={dictionary.matchDetail.notFoundDescription}
                    actions={
                        <Button
                            asChild
                            variant="outline"
                            className="rounded-xl"
                        >
                            <Link href={listHref}>
                                {dictionary.matchDetail.backToMatches}
                            </Link>
                        </Button>
                    }
                />
            </div>
        )
    }

    const activeTab: MatchDetailTab = isMatchDetailTab(tab) ? tab : "overview"
    const { canAdmin, discordConfig } = context
    const timeZone = discordConfig?.timezone ?? "UTC"
    const gameId: GameId = event.gameId ?? "hell_let_loose"
    const guildDiscordId = context.server.discordId
    const roster = context.rosters.find((item) => item.eventId === eventId)
    // Closing a match scores every active member of the clan, whatever game.
    const allAssignments =
        gameScope === "all"
            ? context.assignments
            : ((await getServerContext(serverId, "all"))?.assignments ??
              context.assignments)
    const memberIds = [
        ...new Set(
            allAssignments
                .filter((assignment) => !assignment.paused)
                .map((assignment) => assignment.userId)
        ),
    ]
    const scoreSettings =
        discordConfig?.membershipSettings?.rosterScoreSettings ??
        DEFAULT_ROSTER_SCORE_SETTINGS
    const closeSummary = summarizeRosterScoreChanges({
        userIds: memberIds,
        settings: scoreSettings,
        participants: event.participants,
        notices: event.absenceNotices,
        roster: roster ?? null,
    })

    const [messages, review] = await Promise.all([
        getEventDiscordMessages(event.id),
        canAdmin
            ? getEventResultReview({
                  guildId: guildDiscordId,
                  gameId,
                  eventId: event.id,
                  actorId: session.sub,
              })
            : Promise.resolve(null),
    ])
    const resultState: MatchResultState =
        review?.current?.status ?? (event.eventResult ? "imported" : "none")
    const rosterPlayerIds =
        roster?.squads.flatMap((squad) =>
            squad.players.flatMap((player) => (player.id ? [player.id] : []))
        ) ?? []
    const presentCount =
        (roster?.squads.reduce(
            (sum, squad) =>
                sum +
                squad.players.filter((player) => player.id && player.confirmed)
                    .length,
            0
        ) ?? 0) +
        (roster?.reserveAttendances?.filter((item) => item.confirmed).length ??
            0)
    const signedUpCount = event.participants.filter(
        (participant) => participant.status === "attending"
    ).length
    const phases = deriveMatchPhases(
        {
            createdAt: event.createdAt,
            registrationStart: event.registrationStart,
            registrationEnd: event.registrationEnd,
            meetingStart: event.meetingStart,
            gameEnd: event.gameEnd,
            status: event.status,
            signedUpCount,
            roster: roster
                ? {
                      published: roster.published,
                      assignedCount: rosterPlayerIds.length,
                  }
                : null,
            presentCount,
            result: resultState,
        },
        new Date()
    )

    const basePath = `/${locale}/dashboard/servers/${serverId}/${section}/${event.id}`
    const tabHref = (target: MatchDetailTab) => {
        const params = new URLSearchParams()
        if (isGameId(game)) params.set("game", game)
        if (target !== "overview") params.set("tab", target)
        const query = params.toString()
        return query ? `${basePath}?${query}` : basePath
    }
    const announcementChannelId =
        messages?.announcementChannelId ?? event.announcementChannelId
    const discordHref =
        announcementChannelId && messages?.announcementMessageId
            ? discordUrl(
                  guildDiscordId,
                  announcementChannelId,
                  messages.announcementMessageId
              )
            : undefined
    const createRosterHref = canAdmin
        ? `/${locale}/dashboard/servers/${serverId}/rosters/create?game=${gameId}`
        : undefined
    const signupHistoryHref = `/${locale}/dashboard/servers/${serverId}/signup-activity?eventId=${event.id}`
    const reviewerIds =
        activeTab === "result" && review
            ? [
                  ...new Set(
                      review.history.flatMap((revision) =>
                          [revision.reviewerId, revision.createdBy].filter(
                              (id): id is string => Boolean(id)
                          )
                      )
                  ),
              ]
            : []
    const reviewerNames = Object.fromEntries(
        (reviewerIds.length
            ? await getUsersByIds(reviewerIds, guildDiscordId)
            : []
        ).map((user) => [user.discordId, user.name])
    )
    const needsUsers = activeTab === "attendance" || activeTab === "roster"
    const users = needsUsers
        ? await getUsersByIds(
              [
                  ...new Set([
                      ...allAssignments.map((assignment) => assignment.userId),
                      ...event.participants.map((item) => item.userId),
                      ...event.signUps.map((item) => item.userId),
                      ...(roster?.reservePlayerIds ?? []),
                      ...(roster?.notAttendingPlayerIds ?? []),
                      ...rosterPlayerIds,
                  ]),
              ],
              guildDiscordId
          )
        : []

    return (
        <div className="flex flex-col gap-4 pb-6">
            <MatchDetailHeader
                event={event}
                dictionary={dictionary}
                locale={locale}
                timeZone={timeZone}
                listHref={listHref}
                phases={phases}
                activeTab={activeTab}
                tabHref={tabHref}
                tabCounts={{ attendance: signedUpCount }}
                discordHref={discordHref}
                actions={
                    canAdmin &&
                    event.status !== "concluded" &&
                    activeTab !== "attendance" ? (
                        <ConcludeEventButton
                            serverId={serverId}
                            eventId={event.id}
                            disabled={false}
                            dictionary={dictionary}
                            summary={closeSummary}
                        />
                    ) : undefined
                }
            />
            <div className="px-4 lg:px-6">
                {activeTab === "overview" ? (
                    <EventFormPanel
                        event={event}
                        serverId={serverId}
                        locale={locale}
                        topicPresets={context.topicPresets}
                        stratmaps={context.stratmaps}
                        groups={context.groups}
                        eventCategories={context.server.eventCategories ?? []}
                        timezone={timeZone}
                        canEdit={canAdmin}
                        dictionary={dictionary}
                        createMode={false}
                        discordConfig={discordConfig}
                    />
                ) : null}
                {activeTab === "attendance" ? (
                    <MatchAttendancePanel
                        serverId={serverId}
                        event={event}
                        roster={roster ?? null}
                        users={users}
                        memberIds={memberIds}
                        scoreSettings={scoreSettings}
                        closeSummary={closeSummary}
                        canAdmin={canAdmin}
                        meetingChannelConfigured={Boolean(
                            discordConfig?.meetingChannelId
                        )}
                        signupHistoryHref={signupHistoryHref}
                        createRosterHref={createRosterHref}
                        dictionary={dictionary}
                    />
                ) : null}
                {activeTab === "roster" ? (
                    roster && (canAdmin || roster.published) ? (
                        <LiveRosterBoard
                            rosterId={roster.id}
                            serverId={serverId}
                            locale={locale}
                            grant={issueClientGrant(
                                { discordId: session.sub, sid: session.sid },
                                clientGrantScopes.roster(serverId, roster.id)
                            )}
                            dictionary={dictionary}
                            initialRoster={roster}
                            initialEvent={event}
                            initialUsers={users}
                            initialAssignments={context.assignments}
                            initialGroups={context.groups}
                            initialSquadPresets={context.squadPresets}
                            initialCanAdmin={canAdmin}
                            initialDiscordConfig={
                                discordConfig
                                    ? {
                                          timezone: discordConfig.timezone,
                                          meetingChannelId:
                                              discordConfig.meetingChannelId,
                                      }
                                    : null
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={ClipboardList}
                            title={
                                canAdmin
                                    ? dictionary.matchDetail.roster.missingTitle
                                    : dictionary.roster.rosterNotAvailable
                            }
                            description={
                                canAdmin
                                    ? dictionary.matchDetail.roster
                                          .missingDescription
                                    : undefined
                            }
                            actions={
                                createRosterHref ? (
                                    <Button asChild className="rounded-xl">
                                        <Link href={createRosterHref}>
                                            {
                                                dictionary.matchDetail.roster
                                                    .create
                                            }
                                        </Link>
                                    </Button>
                                ) : undefined
                            }
                        />
                    )
                ) : null}
                {activeTab === "discord" ? (
                    <MatchDiscordPanel
                        event={event}
                        guildDiscordId={guildDiscordId}
                        messages={messages}
                        eventInfoChannelId={
                            event.eventInfoChannelId ??
                            discordConfig?.eventInfoChannelId
                        }
                        meetingChannelId={
                            event.meetingChannelId ??
                            discordConfig?.meetingChannelId
                        }
                        dictionary={dictionary}
                    />
                ) : null}
                {activeTab === "result" ? (
                    <div className="space-y-4">
                        {canAdmin ? (
                            <ResultReview
                                serverId={serverId}
                                eventId={event.id}
                                gameId={gameId}
                                dictionary={dictionary}
                                initialData={review}
                                matchStart={event.gameStart}
                                locale={locale}
                                timeZone={timeZone}
                                actorNames={reviewerNames}
                            />
                        ) : (
                            <EmptyState
                                title={dictionary.matchDetail.result.title}
                                description={
                                    dictionary.matchDetail.result.membersOnly
                                }
                            />
                        )}
                        <section className="border-border/60 bg-card flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                            <div>
                                <h2 className="text-base font-semibold">
                                    {dictionary.matchDetail.result.stats}
                                </h2>
                                <p className="text-muted-foreground text-sm">
                                    {event.matchStatsId
                                        ? dictionary.matchDetail.result
                                              .statsDescription
                                        : dictionary.event.noMatchLinked}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {event.matchStatsId ? (
                                    <Button
                                        asChild
                                        variant="outline"
                                        className="rounded-xl"
                                    >
                                        <Link
                                            href={
                                                section === "matches"
                                                    ? `${basePath}/match-stats`
                                                    : `${basePath}/match`
                                            }
                                        >
                                            {
                                                dictionary.matchDetail.result
                                                    .openStats
                                            }
                                        </Link>
                                    </Button>
                                ) : null}
                                {canAdmin && event.status === "concluded" ? (
                                    <SubmitMatchResultsButton
                                        serverId={serverId}
                                        eventId={event.id}
                                        gameId={gameId}
                                        reviewable={false}
                                        dictionary={dictionary}
                                    />
                                ) : null}
                            </div>
                        </section>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
