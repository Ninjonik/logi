import type { Metadata } from "next"

import { RefreshPerformanceHistoryButton } from "@/components/app/refresh-performance-history-button"
import { MigrateMembershipStatusButton } from "@/components/app/migrate-membership-status-button"
import { LinkMissingDiscordIdsButton } from "@/components/app/link-missing-discord-ids-button"
import { ServerFrontendSettingsForm } from "@/components/app/server-frontend-settings-form"
import { ImportDiscordMembersButton } from "@/components/app/import-discord-members-button"
import { AutoLinkPlatformIdsButton } from "@/components/app/auto-link-platform-ids-button"
import { DiscordServerSettingsForm } from "@/components/app/discord-server-settings-form"
import { DedupePlayerStatsButton } from "@/components/app/dedupe-player-stats-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ImportEventsButton } from "@/components/app/import-events-button"
import { HelperDataActions } from "@/components/app/helper-data-actions"
import { GameSettingsForm } from "@/components/app/game-settings-form"
import { isGameId, withGameOverrides } from "@/domain/games/game"
import { ApiKeyManager } from "@/components/app/api-key-manager"
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
                    <Card className="border-border/60 rounded-2xl">
                        <CardHeader>
                            <CardTitle>Website API</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ApiKeyManager serverId={serverId} />
                        </CardContent>
                    </Card>
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
                {canAdmin ? (
                    <Card className="border-border/60 rounded-2xl">
                        <CardHeader>
                            <CardTitle>
                                {dictionary.clan.importsTitle}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-muted-foreground text-sm">
                                {dictionary.clan.importsBody}
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <ImportEventsButton
                                    serverId={serverId}
                                    dictionary={dictionary}
                                />
                                <ImportDiscordMembersButton
                                    serverId={serverId}
                                    dictionary={dictionary}
                                    defaultRoleId={
                                        context.discordConfig?.clanRoleId
                                    }
                                />
                                <AutoLinkPlatformIdsButton
                                    serverId={serverId}
                                    dictionary={dictionary}
                                />
                                <LinkMissingDiscordIdsButton
                                    serverId={serverId}
                                    dictionary={dictionary}
                                    defaultRoleId={
                                        context.discordConfig?.clanRoleId
                                    }
                                />
                                <MigrateMembershipStatusButton
                                    serverId={serverId}
                                    dictionary={dictionary}
                                    defaultRoleId={
                                        context.discordConfig?.clanRoleId
                                    }
                                />
                                <DedupePlayerStatsButton
                                    serverId={serverId}
                                    dictionary={dictionary}
                                />
                                <RefreshPerformanceHistoryButton
                                    serverId={serverId}
                                    dictionary={dictionary}
                                />
                            </div>
                        </CardContent>
                    </Card>
                ) : null}
                {canAdmin ? (
                    <Card className="border-border/60 rounded-2xl">
                        <CardHeader>
                            <CardTitle>
                                {dictionary.clan.helperDataTitle}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-muted-foreground text-sm">
                                {dictionary.clan.helperDataBody}
                            </p>
                            <HelperDataActions
                                serverId={serverId}
                                dictionary={dictionary}
                            />
                        </CardContent>
                    </Card>
                ) : null}
            </div>
        </>
    )
}
