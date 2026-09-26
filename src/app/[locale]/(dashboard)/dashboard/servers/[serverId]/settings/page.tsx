import type { Metadata } from "next"

import { ServerFrontendSettingsForm } from "@/components/app/server-frontend-settings-form"
import { DiscordServerSettingsForm } from "@/components/app/discord-server-settings-form"
import { GameSettingsForm } from "@/components/app/game-settings-form"
import { isGameId, withGameOverrides } from "@/domain/games/game"
import { PageHeader } from "@/components/app/page-header"
import { getGuildMetadata } from "@/lib/server-metadata"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"
import { getSiteUrl } from "@/lib/env"

export const metadata: Metadata = {
    title: "Server settings | Logi",
    description: "Manage server and Discord settings.",
}

export default async function ServerSettingsPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId } = await params
    const { game } = await searchParams
    const gameId = isGameId(game) ? game : undefined
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const context = await getServerContext(serverId, gameId ?? "all")
    if (!context) return null
    const { server, canAdmin } = context
    const guildLoginUrl = `${getSiteUrl()}/${locale}/guild-login/${server.discordId}`

    return (
        <>
            <PageHeader
                title={dictionary.serverSettings.title}
                description={dictionary.serverSettings.pageDescription}
            />
            <div className="space-y-6 px-4 lg:px-6">
                {canAdmin ? (
                    <GameSettingsForm
                        serverId={serverId}
                        userId={context.user.discordId}
                        enabledGames={server.enabledGames}
                        dictionary={dictionary}
                    />
                ) : null}
                {canAdmin ? (
                    <ServerFrontendSettingsForm
                        server={server}
                        dictionary={dictionary}
                        guildLoginUrl={guildLoginUrl}
                    />
                ) : null}
                {canAdmin ? (
                    <DiscordServerSettingsForm
                        serverId={serverId}
                        userId={context.user.discordId}
                        dictionary={dictionary}
                        config={
                            context.discordConfig
                                ? withGameOverrides(
                                      context.discordConfig,
                                      context.discordConfig.gameOverrides,
                                      gameId
                                  )
                                : null
                        }
                        baseConfig={context.discordConfig}
                        gameId={gameId}
                    />
                ) : null}
            </div>
        </>
    )
}
