import { clanFlowProps } from "@/components/app/new-match/new-match-page"
import { NewMatchFlow } from "@/components/app/new-match/new-match-flow"
import { ManagersOnlyState } from "@/components/app/managers-only-state"
import { sharedAcceptanceContext } from "@/lib/gateways/shared-matches"
import { getLinkedClanTeams } from "@/lib/read-models/clan-teams"
import { getServerContext } from "@/lib/server-context"
import { resolveGameScope } from "@/domain/games/game"
import { makeFunctionReference } from "convex/server"
import { getDictionary } from "@/i18n/dictionaries"
import { fetchQuery } from "convex/nextjs"
import { isLocale } from "@/i18n/config"

export default async function AcceptMatchPage({
    params,
}: {
    params: Promise<{ locale: string; serverId: string; invitationId: string }>
}) {
    const { locale, serverId, invitationId } = await params
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const context = await getServerContext(serverId, "all")
    const listHref = `/${locale}/dashboard/servers/${serverId}/matches`
    if (!context?.canAdmin)
        return (
            <ManagersOnlyState
                dictionary={dictionary}
                overviewHref={listHref}
            />
        )
    const [{ event, groups }, linkedTeams, gameCatalogue] = await Promise.all([
        sharedAcceptanceContext(serverId, invitationId),
        getLinkedClanTeams(context.server.discordId),
        fetchQuery(makeFunctionReference<"query">("gameCatalog:list"), {}),
    ])
    const shared = clanFlowProps({
        context,
        dictionary,
        locale,
        serverId,
        linkedTeams,
    })
    return (
        <NewMatchFlow
            {...shared}
            groups={groups}
            gameCatalogue={gameCatalogue}
            initialKind="match"
            initialGameId={resolveGameScope(event.gameId)}
            draft={null}
            shared={{ invitationId }}
            edit={{
                event,
                detailHref: listHref,
                listHref,
                initialStep: "match",
                series: null,
                rosterExists: true,
                signups: { total: 0, byGroup: {} },
            }}
        />
    )
}
