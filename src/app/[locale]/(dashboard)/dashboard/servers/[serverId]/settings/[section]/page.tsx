import { notFound, redirect } from "next/navigation"
import type { ReactNode } from "react"
import type { Metadata } from "next"
import Link from "next/link"

import {
    isSettingsSectionId,
    mergedSettingsSection,
    visibleSettingsSections,
} from "@/domain/workspaces/settings-sections"
import {
    ChannelScopeLegend,
    DiscordChannelSettingsForm,
} from "@/components/app/settings/discord-channel-settings-form"
import { StatsCommandSettingsForm } from "@/components/app/settings/stats-command-settings-form"
import { DiscordRoleSettingsForm } from "@/components/app/settings/discord-role-settings-form"
import { DiscordMessagesSettings } from "@/components/app/settings/discord-messages-settings"
import { MatchTemplatesSettings } from "@/components/app/settings/match-templates-settings"
import { ServerFrontendSettingsForm } from "@/components/app/server-frontend-settings-form"
import { SettingsSectionFrame } from "@/components/app/settings/settings-section-frame"
import { MaintenanceImports } from "@/components/app/settings/maintenance-imports"
import { MembershipSettingsForm } from "@/components/app/membership-settings-form"
import { settingsHref } from "@/components/app/settings/settings-section-meta"
import { settingsSnapshot } from "@/components/app/settings/settings-snapshot"
import { WardogsLeaguePreview } from "@/components/app/wardogs-league-preview"
import { CalendarFeedSettings } from "@/components/app/calendar-feed-settings"
import { WebsiteSettings } from "@/components/app/settings/website-settings"
import { PresetsOverview } from "@/components/app/settings/presets-overview"
import { GameDataConnections } from "@/components/app/game-data-connections"
import { TicketSettingsForm } from "@/components/app/ticket-settings-form"
import { LeagueTrackingForm } from "@/components/app/league-tracking-form"
import { HelperDataActions } from "@/components/app/helper-data-actions"
import { getDiscordConfigByGuild } from "@/lib/server-discord-settings"
import { GameSettingsForm } from "@/components/app/game-settings-form"
import { getRoleAccessOverview } from "@/lib/read-models/role-access"
import { WebhookManager } from "@/components/app/webhook-manager"
import { DEFAULT_GAME_ID, isGameId } from "@/domain/games/game"
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

export default async function ServerSettingsSectionPage({
    params,
    searchParams,
}: {
    params: Params
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId, section } = await params
    const { game } = await searchParams
    const gameId = isGameId(game) ? game : undefined
    const merged = mergedSettingsSection(section)
    if (merged) redirect(settingsHref(locale, serverId, merged, gameId))
    if (!isSettingsSectionId(section)) notFound()
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

    let content: ReactNode
    let legend: ReactNode
    switch (section) {
        case "profile":
            content = (
                <ServerFrontendSettingsForm
                    server={server}
                    dictionary={dictionary}
                    guildLoginUrl={guildLoginUrl}
                    showLoginLink={false}
                    part="profile"
                />
            )
            break
        case "event-categories":
            content = (
                <ServerFrontendSettingsForm
                    server={server}
                    dictionary={dictionary}
                    guildLoginUrl={guildLoginUrl}
                    showLoginLink={false}
                    part="categories"
                />
            )
            break
        case "match-templates":
            content = (
                <MatchTemplatesSettings
                    serverId={serverId}
                    templates={server.matchTemplates ?? []}
                    categories={server.eventCategories ?? []}
                    groups={context.groups}
                    topicPresets={context.topicPresets}
                    squadPresets={context.squadPresets}
                    enabledGames={snapshot.enabledGames}
                    announcementChannelId={
                        discordConfig?.announcementsChannelId
                    }
                    channelsHref={settingsHref(locale, serverId, "channels")}
                    locale={locale}
                    dictionary={dictionary}
                />
            )
            break
        case "presets":
            content = (
                <PresetsOverview
                    locale={locale}
                    serverId={serverId}
                    squadPresetCount={context.squadPresets.length}
                    topicPresetCount={context.topicPresets.length}
                    dictionary={dictionary}
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
                <DiscordMessagesSettings
                    serverId={serverId}
                    gameId={gameId}
                    config={discordConfig}
                    enabledGames={snapshot.enabledGames}
                    hrefs={{
                        channels: settingsHref(
                            locale,
                            serverId,
                            "channels",
                            gameId
                        ),
                        league: settingsHref(
                            locale,
                            serverId,
                            "league",
                            gameId
                        ),
                        matchTemplates: settingsHref(
                            locale,
                            serverId,
                            "match-templates",
                            gameId
                        ),
                    }}
                    dictionary={dictionary}
                />
            )
            break
        case "channels":
            legend =
                snapshot.enabledGames.length > 1 ? (
                    <ChannelScopeLegend
                        dictionary={dictionary}
                        exampleGame={snapshot.enabledGames[1]!}
                    />
                ) : undefined
            content = (
                <DiscordChannelSettingsForm
                    serverId={serverId}
                    dictionary={dictionary}
                    config={discordConfig}
                    enabledGames={snapshot.enabledGames}
                />
            )
            break
        case "roles":
            content = (
                <DiscordRoleSettingsForm
                    serverId={serverId}
                    dictionary={dictionary}
                    config={discordConfig}
                    access={await getRoleAccessOverview(serverId)}
                    now={new Date()}
                />
            )
            break
        case "stats":
            content = (
                <StatsCommandSettingsForm
                    serverId={serverId}
                    dictionary={dictionary}
                    config={discordConfig}
                    enabledGames={snapshot.enabledGames}
                    gameServersHref={`/${locale}/dashboard/servers/${serverId}/settings/game-servers${gameId ? `?game=${gameId}` : ""}`}
                />
            )
            break
        case "membership":
            content = (
                <MembershipSettingsForm
                    serverId={serverId}
                    config={discordConfig}
                    dictionary={dictionary}
                    rolesHref={settingsHref(locale, serverId, "roles", gameId)}
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
                    <LeagueTrackingForm
                        serverId={serverId}
                        dictionary={dictionary}
                        events={context.events
                            .filter(
                                (event) =>
                                    event.gameId === "wardogs" &&
                                    event.kind === "match"
                            )
                            .sort((a, b) =>
                                b.gameStart.localeCompare(a.gameStart)
                            )
                            .map((event) => ({
                                id: event.id,
                                name: event.name,
                                startsAt: event.gameStart,
                            }))}
                    />
                    <WardogsLeaguePreview serverId={serverId} />
                </div>
            )
            break
        case "website":
            content = (
                <WebsiteSettings
                    serverId={serverId}
                    dictionary={dictionary}
                    guildLoginUrl={guildLoginUrl}
                />
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
            legend={legend}
            ownHeader={section === "tickets" || section === "game-servers"}
        >
            {content}
        </SettingsSectionFrame>
    )
}
