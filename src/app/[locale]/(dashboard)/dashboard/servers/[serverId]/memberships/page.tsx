import type { Metadata } from "next"

import { MembershipSettingsForm } from "@/components/app/membership-settings-form"
import { getDiscordConfigByGuild } from "@/lib/server-discord-settings"
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
    const discordConfig = await getDiscordConfigByGuild(serverId)

    return (
        <>
            <PageHeader
                title={dictionary.membershipSettings.title}
                description={dictionary.membershipSettings.pageDescription}
            />
            <div className="space-y-6 px-4 lg:px-6">
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
