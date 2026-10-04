import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import type { Metadata } from "next"
import Link from "next/link"

import {
    isSettingsSectionId,
    visibleSettingsSections,
} from "@/domain/workspaces/settings-sections"
import { DiscordChannelSettingsForm } from "@/components/app/settings/discord-channel-settings-form"
import { StatsCommandSettingsForm } from "@/components/app/settings/stats-command-settings-form"
import { MembershipIntegrationSettings } from "@/components/app/membership-integration-settings"
import {
    DEFAULT_GAME_ID,
    isGameId,
    withGameOverrides,
} from "@/domain/games/game"
import { DiscordRoleSettingsForm } from "@/components/app/settings/discord-role-settings-form"
import { WebsiteEventPolicySettings } from "@/components/app/website-event-policy-settings"
import { ServerFrontendSettingsForm } from "@/components/app/server-frontend-settings-form"
import { SettingsSectionFrame } from "@/components/app/settings/settings-section-frame"
import { DiscordPublicPanelsForm } from "@/components/app/discord-public-panels-form"
import { MaintenanceImports } from "@/components/app/settings/maintenance-imports"
import { MembershipSettingsForm } from "@/components/app/membership-settings-form"
import { settingsSnapshot } from "@/components/app/settings/settings-snapshot"
import { WardogsLeaguePreview } from "@/components/app/wardogs-league-preview"
import { CalendarFeedSettings } from "@/components/app/calendar-feed-settings"
import { GameDataConnections } from "@/components/app/game-data-connections"
import { TicketSettingsForm } from "@/components/app/ticket-settings-form"
import { LeagueTrackingForm } from "@/components/app/league-tracking-form"
import { HelperDataActions } from "@/components/app/helper-data-actions"
import { getDiscordConfigByGuild } from "@/lib/server-discord-settings"
import { GameSettingsForm } from "@/components/app/game-settings-form"
import { CustomLoginLink } from "@/components/app/custom-login-link"
import { SsoApplications } from "@/components/app/sso-applications"
import { WebhookManager } from "@/components/app/webhook-manager"
import { ApiKeyManager } from "@/components/app/api-key-manager"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"
import { getSiteUrl } from "@/lib/env"

type Params = Promise<{ locale: string; serverId: string; section: string }>

export async function generateMetadata({
    params,
}: {
    params: Params
}): Promise<Metadata> {
    const { locale, section } = await params
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    return {
        title: isSettingsSectionId(section)
            ? dictionary.settingsHub.sections[section].title
            : dictionary.settingsHub.title,
    }
}

function Block({
    title,
    description,
    children,
}: {
    title: string
    description?: string
    children: ReactNode
}) {
    return (
        <section className="space-y-3">
            <div className="space-y-1">
                <h2 className="text-base font-semibold">{title}</h2>
                {description ? (
                    <p className="text-muted-foreground text-sm">
                        {description}
                    </p>
                ) : null}
            </div>
            {children}
        </section>
    )
}

export default async function ServerSettingsSectionPage({
    params,
    searchParams,
}: {
    params: Params
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId, section } = await params
    if (!isSettingsSectionId(section)) notFound()
    const { game } = await searchParams
    const gameId = isGameId(game) ? game : undefined
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const context = await getServerContext(serverId, gameId ?? "all")
    if (!context?.canAdmin) return null
    const { server, discordConfig } = context
    const snapshot = settingsSnapshot(server.enabledGames, discordConfig)
    if (
        !visibleSettingsSections(snapshot.enabledGames).some(
            (visible) => visible.id === section
        )
    )
        notFound()
    const guildLoginUrl = `${getSiteUrl()}/${locale}/guild-login/${server.discordId}`
    const scopedConfig = discordConfig
        ? withGameOverrides(discordConfig, discordConfig.gameOverrides, gameId)
        : null

    let content: ReactNode
    switch (section) {
        case "profile":
            content = (
                <ServerFrontendSettingsForm
                    server={server}
                    dictionary={dictionary}
                    guildLoginUrl={guildLoginUrl}
                    showLoginLink={false}
                />
            )
            break
        case "games":
            content = (
                <GameSettingsForm
                    serverId={serverId}
                    enabledGames={server.enabledGames}
                    dictionary={dictionary}
                />
            )
            break
        case "messages":
            content = (
                <DiscordPublicPanelsForm
                    serverId={serverId}
                    gameId={gameId}
                    dictionary={dictionary}
                />
            )
            break
        case "channels":
            content = (
                <DiscordChannelSettingsForm
                    key={gameId ?? "clan"}
                    serverId={serverId}
                    dictionary={dictionary}
                    config={scopedConfig}
                    baseConfig={discordConfig}
                    gameId={gameId}
                />
            )
            break
        case "roles":
            content = (
                <DiscordRoleSettingsForm
                    serverId={serverId}
                    dictionary={dictionary}
                    config={discordConfig}
                />
            )
            break
        case "stats":
            content = (
                <StatsCommandSettingsForm
                    key={gameId ?? "clan"}
                    serverId={serverId}
                    dictionary={dictionary}
                    config={scopedConfig}
                    baseConfig={discordConfig}
                    gameId={gameId}
                />
            )
            break
        case "membership":
            content = (
                <MembershipSettingsForm
                    serverId={serverId}
                    config={discordConfig}
                    dictionary={dictionary}
                />
            )
            break
        case "tickets":
            content = (
                <TicketSettingsForm
                    serverId={serverId}
                    dictionary={dictionary}
                    config={await getDiscordConfigByGuild(serverId)}
                />
            )
            break
        case "game-servers":
            content = (
                <GameDataConnections
                    serverId={serverId}
                    dictionary={dictionary}
                />
            )
            break
        case "league":
            content = (
                <div className="space-y-6">
                    <LeagueTrackingForm serverId={serverId} />
                    <WardogsLeaguePreview serverId={serverId} />
                </div>
            )
            break
        case "website":
            content = (
                <div className="space-y-8">
                    <Block title={dictionary.clan.websiteApi}>
                        <ApiKeyManager
                            serverId={serverId}
                            dictionary={dictionary}
                        />
                    </Block>
                    <Block title={dictionary.websiteEventPolicies.title}>
                        <WebsiteEventPolicySettings
                            serverId={serverId}
                            dictionary={dictionary}
                        />
                    </Block>
                    <Block title={dictionary.membershipIntegration.title}>
                        <MembershipIntegrationSettings
                            serverId={serverId}
                            dictionary={dictionary}
                        />
                    </Block>
                </div>
            )
            break
        case "login":
            content = (
                <div className="space-y-8">
                    <Block title={dictionary.serverSettings.guildLoginUrl}>
                        <CustomLoginLink
                            url={guildLoginUrl}
                            dictionary={dictionary}
                        />
                    </Block>
                    <Block
                        title={dictionary.serverSettings.ssoTitle}
                        description={dictionary.serverSettings.ssoDescription}
                    >
                        <SsoApplications
                            serverId={serverId}
                            dictionary={dictionary}
                        />
                    </Block>
                </div>
            )
            break
        case "calendar":
            content = (
                <CalendarFeedSettings
                    server={server}
                    dictionary={dictionary}
                    guildLoginUrl={guildLoginUrl}
                    calendarFeedToken={discordConfig?.calendarFeedToken}
                />
            )
            break
        case "webhooks":
            content = (
                <div className="space-y-4">
                    <p className="text-muted-foreground text-sm">
                        {dictionary.clan.webhooksBody}{" "}
                        <Link
                            href="/wiki/configuration/settings#webhooks"
                            className="text-primary font-medium underline-offset-4 hover:underline"
                        >
                            {dictionary.clan.webhookDocumentation}
                        </Link>
                    </p>
                    <WebhookManager
                        serverId={serverId}
                        dictionary={dictionary}
                    />
                </div>
            )
            break
        case "imports":
            content = (
                <MaintenanceImports
                    serverId={serverId}
                    gameId={gameId ?? DEFAULT_GAME_ID}
                    enabledGames={server.enabledGames}
                    defaultRoleId={discordConfig?.clanRoleId}
                    dictionary={dictionary}
                />
            )
            break
        case "helper-data":
            content = (
                <div className="space-y-4">
                    <p className="text-muted-foreground text-sm">
                        {dictionary.clan.helperDataBody}
                    </p>
                    <HelperDataActions
                        serverId={serverId}
                        dictionary={dictionary}
                    />
                </div>
            )
            break
    }

    return (
        <SettingsSectionFrame
            locale={locale}
            serverId={serverId}
            gameId={gameId}
            section={section}
            snapshot={snapshot}
            enabledGames={server.enabledGames}
            dictionary={dictionary}
        >
            {content}
        </SettingsSectionFrame>
    )
}
