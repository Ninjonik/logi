import { notFound } from "next/navigation"
import type { Metadata } from "next"

import {
    calendarPreviewEntries,
    latestResultEvents,
} from "@/components/app/discord-panels/editor-data"
import {
    discordPanelsAccess,
    readDiscordPanels,
} from "@/lib/gateways/discord-panels"
import { SettingsSectionFrame } from "@/components/app/settings/settings-section-frame"
import { normalizeMessageStyle } from "@/domain/discord-messages/message-style"
import { settingsHref } from "@/components/app/settings/settings-section-meta"
import { settingsSnapshot } from "@/components/app/settings/settings-snapshot"
import { DEFAULT_MESSAGE_ACCENT_HEX } from "@/domain/discord-messages/format"
import { getPanelGraphicsPageData } from "@/lib/read-models/panel-graphics"
import { PanelEditor } from "@/components/app/discord-panels/panel-editor"
import { isPanelKind } from "@/domain/discord-publications/panel-editor"
import { panelCompetitions } from "@/lib/read-models/panel-competitions"
import { resolveClanLanguage } from "@/lib/clan-language/core"
import { getPanelMessages } from "@/lib/clan-language/panels"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"
import { getSiteUrl } from "@/lib/env"

type Params = Promise<{
    locale: string
    serverId: string
    section: string
    item: string
}>

/** Panel IDs are Convex document IDs; "new" starts a new panel. */
const PANEL_ID = /^[A-Za-z0-9:_-]{1,100}$/

export async function generateMetadata({
    params,
}: {
    params: Params
}): Promise<Metadata> {
    const { locale } = await params
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    return { title: dictionary.settingsHub.sections["discord-panels"].title }
}

/**
 * The panel editor of "Panely v Discordu" (board P2):
 * `…/settings/discord-panels/new` and `…/settings/discord-panels/<panelId>`.
 */
export default async function PanelEditorPage({
    params,
    searchParams,
}: {
    params: Params
    searchParams: Promise<{ type?: string }>
}) {
    const { locale, serverId, section, item } = await params
    if (section !== "discord-panels" || !PANEL_ID.test(item)) notFound()
    const { type } = await searchParams
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const context = await getServerContext(serverId, "all")
    if (!context?.canAdmin) return null
    const { server, discordConfig } = context
    const snapshot = settingsSnapshot(server.enabledGames, discordConfig)
    const language = resolveClanLanguage(discordConfig?.defaultLanguage)
    const timeZone = discordConfig?.timezone ?? "Europe/Prague"
    const style = normalizeMessageStyle(discordConfig?.messageStyle)
    const categories = server.eventCategories ?? []
    const tickets = discordConfig?.ticketSettings
    const now = new Date().getTime()
    const panelId = item === "new" ? null : item
    const [graphics, competitions, overview] = await Promise.all([
        getPanelGraphicsPageData(server.discordId),
        panelCompetitions(snapshot.enabledGames),
        // Only the panel's name for the breadcrumb; the editor reads the rest.
        panelId
            ? discordPanelsAccess(serverId)
                  .then((access) => (access ? readDiscordPanels(access) : null))
                  .catch(() => null)
            : null,
    ])
    const panel = overview?.panels.find((entry) => entry.id === panelId)
    const panelName =
        panel?.title ??
        overview?.sources.find(
            (source) => source.connectionId === panel?.connectionId
        )?.name ??
        null
    const panelsHref = settingsHref(locale, serverId, "discord-panels")
    return (
        <SettingsSectionFrame
            locale={locale}
            serverId={serverId}
            section="discord-panels"
            snapshot={snapshot}
            enabledGames={server.enabledGames}
            dictionary={dictionary}
            ownHeader
            mobileBreadcrumb
            crumb={
                panelId
                    ? (panelName ?? dictionary.discordPanelsPage.editor.back)
                    : dictionary.discordPanelsPage.editor.newTitle
            }
        >
            <PanelEditor
                key={panelId ?? "new"}
                serverId={serverId}
                guildId={server.discordId}
                panelId={panelId}
                initialKind={type && isPanelKind(type) ? type : null}
                siteUrl={getSiteUrl()}
                clan={{
                    name: server.name,
                    language,
                    timeZone,
                    messageStyle: style,
                    accentHex: style.accentColor ?? DEFAULT_MESSAGE_ACCENT_HEX,
                }}
                defaultStyle={graphics?.settings.defaultStyle ?? "a"}
                enabledGames={snapshot.enabledGames}
                ticketCategories={
                    tickets?.enabled && tickets.ticketParentChannelId
                        ? tickets.categories.map((category) => ({
                              id: category.id,
                              label: category.label || category.id,
                          }))
                        : []
                }
                eventCategories={categories.map((category) => ({
                    id: category.id,
                    label: category.label,
                }))}
                competitions={competitions}
                calendarEntries={calendarPreviewEntries({
                    events: context.events,
                    categories,
                    now,
                    trainingWord:
                        getPanelMessages(language).calendarPanel.training,
                })}
                resultEvents={latestResultEvents({
                    events: context.events,
                    categories,
                    guildDiscordId: server.discordId,
                })}
                hrefs={{
                    panels: panelsHref,
                    gameServers: settingsHref(locale, serverId, "game-servers"),
                    tickets: settingsHref(locale, serverId, "tickets"),
                    seed: settingsHref(locale, serverId, "discord-seed"),
                    graphics: settingsHref(locale, serverId, "panel-graphics"),
                    calendar: `${getSiteUrl()}/${locale}/clans/${server.discordId}`,
                }}
                dictionary={dictionary}
            />
        </SettingsSectionFrame>
    )
}
