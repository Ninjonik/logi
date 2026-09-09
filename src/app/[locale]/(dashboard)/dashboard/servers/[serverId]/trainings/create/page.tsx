import { GameSelectionGate } from "@/components/app/game-selection-gate"
import { EventFormPanel } from "@/components/app/event-form-panel"
import { createDraftEventSchedule } from "@/lib/event-draft"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isGameId } from "@/domain/games/game"
import { isLocale } from "@/i18n/config"

export default async function CreateTrainingPage({
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
    const discordConfig = context?.discordConfig ?? null
    const draftSchedule = createDraftEventSchedule()

    const draftEvent = {
        id: "draft-training",
        guildId: serverId,
        gameId,
        kind: "training" as const,
        name: "",
        description: "",
        thumbnailUrl: "",
        imageUrl: "",
        meetingChannelId: "",
        requiredRoleIds: [],
        rewardRoleIds: [],
        notes: "",
        registrationEnd: draftSchedule.registrationEnd,
        meetingStart: draftSchedule.meetingStart,
        gameStart: draftSchedule.meetingStart,
        gameEnd: draftSchedule.gameEnd,
        pingClan: false,
        createForumChannel: false,
        stratmapIds: [],
        signupGroupIds: [],
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
                title={dictionary.sidebar.trainings}
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
