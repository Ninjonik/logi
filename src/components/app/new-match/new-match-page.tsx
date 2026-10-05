import { isGameId, withGameOverrides, type GameId } from "@/domain/games/game"
import { ManagersOnlyState } from "@/components/app/managers-only-state"
import { getLinkedClanTeams } from "@/lib/read-models/clan-teams"
import { getEventDraft } from "@/lib/gateways/event-drafts"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

import { NewMatchFlow, type NewMatchFlowProps } from "./new-match-flow"

/**
 * Server half of the new-match flow (design D2), shared by the match, event
 * and training create routes. `?draftId=` resumes a draft of this clan; any
 * other ID starts a fresh match.
 */
export async function NewMatchPage({
    locale,
    serverId,
    kind,
    game,
    draftId,
}: {
    locale: string
    serverId: string
    kind: "match" | "training"
    game?: string
    draftId?: string
}) {
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const context = await getServerContext(serverId, "all")
    if (!context?.canAdmin)
        return (
            <ManagersOnlyState
                dictionary={dictionary}
                overviewHref={`/${locale}/dashboard/servers/${serverId}`}
            />
        )
    const [draft, linkedTeams] = await Promise.all([
        draftId ? getEventDraft(serverId, draftId) : Promise.resolve(null),
        getLinkedClanTeams(context.server.discordId),
    ])
    const enabledGames: GameId[] = context.server.enabledGames?.length
        ? context.server.enabledGames
        : ["hell_let_loose"]
    const requested =
        isGameId(game) && enabledGames.includes(game) ? game : null
    const initialGameId = draft?.gameId ?? requested ?? enabledGames[0]
    const config = context.discordConfig
    const channelDefaults: NewMatchFlowProps["channelDefaults"] =
        Object.fromEntries(
            enabledGames.map((gameId) => {
                const scoped = config
                    ? withGameOverrides(config, config.gameOverrides, gameId)
                    : null
                return [
                    gameId,
                    {
                        announcementChannelId:
                            scoped?.announcementsChannelId || undefined,
                        eventInfoChannelId:
                            scoped?.eventInfoChannelId || undefined,
                    },
                ]
            })
        )
    const botLanguage = config?.defaultLanguage ?? "en"

    return (
        <NewMatchFlow
            key={draft?.id ?? "new"}
            serverId={serverId}
            locale={locale}
            dictionary={dictionary}
            previewCopy={getDictionary(botLanguage).newMatch.preview}
            botLanguage={botLanguage}
            initialKind={draft?.kind ?? kind}
            initialGameId={initialGameId}
            enabledGames={enabledGames}
            templates={context.server.matchTemplates ?? []}
            groups={context.groups}
            squadPresets={context.squadPresets}
            eventCategories={context.server.eventCategories ?? []}
            timezone={config?.timezone ?? "UTC"}
            clan={{ name: context.server.name }}
            linkedTeams={linkedTeams}
            channelDefaults={channelDefaults}
            clanRoleId={config?.clanRoleId}
            draft={draft}
        />
    )
}
