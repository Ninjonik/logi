import { getTeamManagementMessages } from "@/i18n/messages/team-management"
import { LeagueAccount } from "@/components/leagues/league-account"
import { readLeagueAccount } from "@/lib/gateways/league-portal"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { isLocale } from "@/i18n/config"

export default async function ServerTeamsPage({
    params,
}: {
    params: Promise<{ locale: string; serverId: string }>
}) {
    const { locale, serverId } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const context = await getServerContext(serverId, "all")
    if (!context?.canAdmin) return null
    const view = await readLeagueAccount(null)
    if (!view) return null
    const m = getTeamManagementMessages(safeLocale)
    return (
        <>
            <PageHeader title={m.title} description={m.description} />
            <div className="space-y-6 px-4 pb-6 lg:px-6">
                <LeagueAccount
                    view={view}
                    locale={safeLocale}
                    competition={null}
                    workspaceGuildId={context.server.discordId}
                />
            </div>
        </>
    )
}
