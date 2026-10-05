import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import { LiveRosterBoard } from "@/components/app/live-roster-board"
import { clientGrantScopes } from "@/domain/identity/client-grant"
import { getUsersByIds } from "@/lib/server-user-management"
import { PageHeader } from "@/components/app/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getServerContext } from "@/lib/server-context"
import { issueClientGrant } from "@/lib/client-grants"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { isGameId } from "@/domain/games/game"
import { isLocale } from "@/i18n/config"
import { getSession } from "@/lib/auth"

export const metadata: Metadata = {
    title: "Roster",
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
    if (!context) notFound()
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
    const session = await getSession()
    if (!session) notFound()
    // An admin sees every roster of the clan, so a missing one does not exist.
    if (!roster && canAdmin) notFound()
    const title = event
        ? dictionary.matchDetail.roster.pageTitle.replace("{name}", event.name)
        : dictionary.roster.title
    const matchHref = event
        ? `/${locale}/dashboard/servers/${serverId}/${event.kind === "training" ? "events" : "matches"}/${event.id}?tab=roster`
        : undefined

    // Members never receive an unpublished roster, not even hidden in props;
    // the clan context already leaves drafts out for them.
    if (!canAdmin && (!roster || !roster.published))
        return (
            <>
                <PageHeader title={title} />
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
            <PageHeader
                title={title}
                actions={
                    matchHref ? (
                        <Button
                            asChild
                            variant="outline"
                            className="rounded-xl"
                        >
                            <Link href={matchHref}>
                                {dictionary.matchDetail.roster.openMatch}
                            </Link>
                        </Button>
                    ) : undefined
                }
            />
            <div className="px-4 lg:px-6">
                <LiveRosterBoard
                    rosterId={rosterId}
                    serverId={serverId}
                    locale={locale}
                    grant={issueClientGrant(
                        { discordId: session.sub, sid: session.sid },
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
