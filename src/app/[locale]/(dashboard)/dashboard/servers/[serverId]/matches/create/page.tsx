import { GameSelectionGate } from "@/components/app/game-selection-gate"
import { EventFormPanel } from "@/components/app/event-form-panel"
import { createDraftEventSchedule } from "@/lib/event-draft"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { withGameOverrides } from "@/domain/games/game"
import { getDictionary } from "@/i18n/dictionaries"
import { isGameId } from "@/domain/games/game"
import { isLocale } from "@/i18n/config"

export default async function CreateMatchPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId } = await params
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const { game } = await searchParams
    const gameId = isGameId(game) ? game : undefined
    const context = await getServerContext(serverId, gameId ?? "all")
    if (!context?.canAdmin) return null
    if (!gameId)
        return (
            <GameSelectionGate
                enabledGames={context.server.enabledGames}
                dictionary={dictionary}
            />
        )
    const canAdmin = context?.canAdmin ?? false
    const topicPresets = context?.topicPresets ?? []
    const stratmaps = context?.stratmaps ?? []
    const groups = context?.groups ?? []
    const timezone = context?.discordConfig?.timezone ?? "UTC"
    const discordConfig = context?.discordConfig
        ? withGameOverrides(
              context.discordConfig,
              context.discordConfig.gameOverrides,
              gameId
          )
        : null
    const draftSchedule = createDraftEventSchedule()

    const draftEvent = {
        id: "draft-match",
        guildId: serverId,
        gameId,
        kind: "match" as const,
        name: "",
        description: "",
        thumbnailUrl: "",
        imageUrl: "",
        meetingChannelId: "",
        requiredRoleIds: [],
        rewardRoleIds: [],
        server: "",
        serverPassword: "",
        side: "",
        map: "",
        cap: "",
        notes: "",
        registrationEnd: draftSchedule.registrationEnd,
        meetingStart: draftSchedule.meetingStart,
        gameStart: draftSchedule.gameStart,
        gameEnd: draftSchedule.gameEnd,
        pingClan: false,
        createForumChannel: true,
        stratmapIds: [],
        signupGroupIds: groups.map((group) => group.id),
        allowedSignupStatuses: undefined,
        useGeneralSignup: false,
        status: "registration" as const,
        statusUpdatedAt: draftSchedule.statusUpdatedAt,
        attendanceReminderLog: [],
        participants: [],
        signUps: [],
        absenceNotices: [],
        createdAt: draftSchedule.createdAt,
        updatedAt: draftSchedule.updatedAt,
    }

    return (
        <>
            <PageHeader
                title={dictionary.event.createTitle}
                description={dictionary.event.createPageDescription}
            />
            <div className="px-4 lg:px-6">
                <EventFormPanel
                    event={draftEvent}
                    serverId={serverId}
                    locale={locale}
                    topicPresets={topicPresets}
                    stratmaps={stratmaps}
                    groups={groups}
                    eventCategories={context?.server.eventCategories ?? []}
                    timezone={timezone}
                    canEdit={canAdmin}
                    dictionary={dictionary}
                    createMode
                    discordConfig={discordConfig}
                />
            </div>
        </>
    )
}
