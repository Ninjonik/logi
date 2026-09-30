import type { Metadata } from "next"

import { ConfigurationScopeIndicator } from "@/components/app/configuration-scope-indicator"
import { MembershipSettingsForm } from "@/components/app/membership-settings-form"
import { GameSelectionGate } from "@/components/app/game-selection-gate"
import { isGameId, withGameOverrides } from "@/domain/games/game"
import { PageHeader } from "@/components/app/page-header"
import { getGuildMetadata } from "@/lib/server-metadata"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Membership settings | Logi",
    description: "Manage server membership settings.",
}

export default async function ServerMembershipsPage({
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
    if (!context?.canAdmin) return null
    if (!gameId)
        return (
            <GameSelectionGate
                enabledGames={context.server.enabledGames}
                dictionary={dictionary}
            />
        )
    const discordConfig = context.discordConfig

    return (
        <>
            <PageHeader
                title={dictionary.membershipSettings.title}
                description={dictionary.membershipSettings.pageDescription}
            />
            <div className="space-y-6 px-4 lg:px-6">
                <ConfigurationScopeIndicator
                    enabledGames={context.server.enabledGames}
                    gameId={gameId}
                    dictionary={dictionary}
                />
                <MembershipSettingsForm
                    serverId={serverId}
                    config={
                        discordConfig
                            ? withGameOverrides(
                                  discordConfig,
                                  discordConfig.gameOverrides,
                                  gameId
                              )
                            : null
                    }
                    baseConfig={discordConfig}
                    gameId={gameId}
                    dictionary={dictionary}
                />
            </div>
        </>
    )
}
