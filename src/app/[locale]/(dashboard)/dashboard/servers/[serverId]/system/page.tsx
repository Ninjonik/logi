import { ConfigurationScopeIndicator } from "@/components/app/configuration-scope-indicator"
import { SystemMaintenanceSections } from "@/components/app/system-maintenance-sections"
import { DiscordOperationsSettings } from "@/components/app/discord-operations-settings"
import { CalendarFeedSettings } from "@/components/app/calendar-feed-settings"
import { CustomLoginLink } from "@/components/app/custom-login-link"
import { SsoApplications } from "@/components/app/sso-applications"
import { ApiKeyManager } from "@/components/app/api-key-manager"
import { DEFAULT_GAME_ID, isGameId } from "@/domain/games/game"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"
import { getSiteUrl } from "@/lib/env"

export default async function SystemPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId } = await params
    const { game } = await searchParams
    const gameId = isGameId(game) ? game : DEFAULT_GAME_ID
    const context = await getServerContext(serverId, gameId)
    if (!context?.canAdmin) return null
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const guildLoginUrl = `${getSiteUrl()}/${locale}/guild-login/${context.server.discordId}`
    return (
        <>
            <PageHeader
                title={dictionary.clan.systemTitle}
                description={dictionary.clan.systemBody}
            />
            <div className="space-y-6 px-4 lg:px-6">
                <ConfigurationScopeIndicator
                    enabledGames={context.server.enabledGames}
                    gameId={isGameId(game) ? game : undefined}
                    dictionary={dictionary}
                />
                <SystemMaintenanceSections
                    serverId={serverId}
                    gameId={gameId}
                    enabledGames={context.server.enabledGames}
                    defaultRoleId={context.discordConfig?.clanRoleId}
                    dictionary={dictionary}
                    additionalSections={[
                        {
                            id: "website-api",
                            title: dictionary.clan.websiteApi,
                            description: "",
                            content: <ApiKeyManager serverId={serverId} />,
                        },
                        {
                            id: "google-calendar",
                            title: dictionary.serverSettings
                                .googleCalendarTitle,
                            description:
                                dictionary.serverSettings
                                    .googleCalendarDescription,
                            content: (
                                <CalendarFeedSettings
                                    server={context.server}
                                    dictionary={dictionary}
                                    guildLoginUrl={guildLoginUrl}
                                    calendarFeedToken={
                                        context.discordConfig?.calendarFeedToken
                                    }
                                />
                            ),
                        },
                        {
                            id: "custom-login",
                            title: dictionary.serverSettings.guildLoginUrl,
                            description: "",
                            content: (
                                <CustomLoginLink
                                    url={guildLoginUrl}
                                    dictionary={dictionary}
                                />
                            ),
                        },
                        {
                            id: "sso",
                            title: dictionary.serverSettings.ssoTitle,
                            description:
                                dictionary.serverSettings.ssoDescription,
                            content: (
                                <SsoApplications
                                    serverId={serverId}
                                    dictionary={dictionary}
                                />
                            ),
                        },
                        {
                            id: "discord-operations",
                            title: dictionary.serverSettings.discordTitle,
                            description:
                                dictionary.serverSettings
                                    .playerStatsServersDescription,
                            content: (
                                <DiscordOperationsSettings
                                    serverId={serverId}
                                    userId={context.user.discordId}
                                    config={context.discordConfig}
                                    dictionary={dictionary}
                                />
                            ),
                        },
                    ]}
                />
            </div>
        </>
    )
}
