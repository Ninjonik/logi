import { GameSelectionGate } from "@/components/app/game-selection-gate"
import { RosterCreator } from "@/components/app/roster-creator"
import { getUsersByIds } from "@/lib/server-user-management"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isGameId } from "@/domain/games/game"
import { isLocale } from "@/i18n/config"

export default async function CreateRosterPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId } = await params
    const { game } = await searchParams
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const context = await getServerContext(
        serverId,
        isGameId(game) ? game : "all"
    )
    if (!context) return null
    if (!context.canAdmin) return null
    if (!isGameId(game))
        return (
            <GameSelectionGate
                enabledGames={context.server.enabledGames}
                dictionary={dictionary}
            />
        )
    const {
        events,
        rosters,
        squadPresets,
        canAdmin,
        assignments = [],
        groups = [],
        discordConfig,
    } = context
    const rosterEligibleEvents = events.filter(
        (event) => event.status !== "concluded"
    )
    const rosterUserIds = Array.from(
        new Set([
            ...assignments.map((assignment) => assignment.userId),
            ...rosterEligibleEvents.flatMap((event) => [
                ...event.signUps.map((signUp) => signUp.userId),
                ...event.participants.map((participant) => participant.userId),
            ]),
        ])
    )
    const reserveUsers = await getUsersByIds(
        rosterUserIds,
        context.server.discordId
    )

    return (
        <>
            <PageHeader
                title={dictionary.common.createRoster}
                description={dictionary.shared.rosterPageDescription}
            />
            <div className="px-4 lg:px-6">
                <RosterCreator
                    events={rosterEligibleEvents}
                    rosters={rosters}
                    squadPresets={squadPresets}
                    users={reserveUsers}
                    userAssignments={assignments}
                    groups={groups}
                    canAdmin={canAdmin}
                    dictionary={dictionary}
                    serverId={serverId}
                    locale={locale}
                    timezone={discordConfig?.timezone}
                />
            </div>
        </>
    )
}
