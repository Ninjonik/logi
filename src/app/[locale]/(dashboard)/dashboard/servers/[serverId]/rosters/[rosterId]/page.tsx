import type { Metadata } from "next"

import { getEventMetadata, getRosterMetadata } from "@/lib/server-metadata"
import { LiveRosterBoard } from "@/components/app/live-roster-board"
import { clientGrantScopes } from "@/domain/identity/client-grant"
import { getUsersByIds } from "@/lib/server-user-management"
import { PageHeader } from "@/components/app/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getServerContext } from "@/lib/server-context"
import { issueClientGrant } from "@/lib/client-grants"
import { getDictionary } from "@/i18n/dictionaries"
import { isGameId } from "@/domain/games/game"
import { getLoggedInUser } from "@/lib/auth"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Roster | Logi",
    description:
        "Roster board with reserves, role slots, publish state, and acknowledgements.",
}

export function generateStaticParams() {
    return [{ rosterId: "sample-roster" }]
}

export default async function RosterDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string; rosterId: string }>
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId, rosterId } = await params
    const { game } = await searchParams
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const context = await getServerContext(
        serverId,
        isGameId(game) ? game : "all"
    )
    if (!context) return null
    const {
        rosters,
        events,
        squadPresets,
        canAdmin,
        assignments = [],
        groups = [],
        discordConfig,
    } = context
    const roster = rosters.find((item) => item.id === rosterId)
    const event = events.find((item) => item.id === roster?.eventId)
    const users = await getUsersByIds(
        Array.from(
            new Set([
                ...assignments.map((assignment) => assignment.userId),
                ...(event?.participants.map(
                    (participant) => participant.userId
                ) ?? []),
                ...(event?.signUps.map((signUp) => signUp.userId) ?? []),
                ...(roster?.reservePlayerIds ?? []),
                ...(roster?.notAttendingPlayerIds ?? []),
                ...(roster?.squads.flatMap(
                    (squad) =>
                        squad.players
                            .map((player) => player.id)
                            .filter(Boolean) as string[]
                ) ?? []),
            ])
        ),
        context.server.discordId
    )
    const user = await getLoggedInUser()
    if (!user) return null

    // Members never receive an unpublished roster, not even hidden in props.
    if (roster && !roster.published && !canAdmin)
        return (
            <>
                <PageHeader title={event ? `${event.name} roster` : "Roster"} />
                <div className="px-4 lg:px-6">
                    <Card className="border-border/80 rounded-2xl border-dashed">
                        <CardContent className="text-muted-foreground py-16 text-center">
                            {dictionary.roster.rosterNotAvailable}
                        </CardContent>
                    </Card>
                </div>
            </>
        )

    return (
        <>
            <PageHeader title={event ? `${event.name} roster` : "Roster"} />
            <div className="px-4 lg:px-6">
                <LiveRosterBoard
                    rosterId={rosterId}
                    serverId={serverId}
                    locale={locale}
                    grant={issueClientGrant(
                        user.discordId,
                        clientGrantScopes.roster(serverId, rosterId)
                    )}
                    dictionary={dictionary}
                    initialRoster={roster}
                    initialEvent={event}
                    initialUsers={users}
                    initialAssignments={assignments}
                    initialGroups={groups}
                    initialSquadPresets={squadPresets}
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
            </div>
        </>
    )
}
