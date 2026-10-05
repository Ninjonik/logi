/**
 * The ticket panel the bot keeps in the ticket channel (L4-35..37): one
 * Components V2 card in the clan colour, or the colour set in Nastavení →
 * Tickety → Panel, with the categories as text lines and grey buttons.
 */

import { ticketPanelView } from "../../../src/domain/discord-tickets/ticket-views"
import { getTicketMessages } from "../../../src/lib/clan-language/tickets"
import { formatDiscordMarkdown } from "../../../src/lib/discord-markdown"
import { messagePayload } from "../ui/message-kit"
import type { DiscordConfig } from "../types"
import { env } from "../environment"

/** The panel message, or null when tickets have no categories to show. */
export function buildTicketPanelMessage(
    config: Pick<
        DiscordConfig,
        "ticketSettings" | "defaultLanguage" | "messageStyle"
    >,
    siteUrl: string = env.appSiteUrl
) {
    const settings = config.ticketSettings
    if (!settings?.categories.length) return null
    const options = {
        language: config.defaultLanguage,
        style: config.messageStyle,
    }
    return messagePayload(
        ticketPanelView({
            title: settings.panelTitle,
            description: formatDiscordMarkdown(settings.panelDescription),
            imageUrl: settings.panelImageUrl,
            accentColor: settings.panelAccentColor,
            categories: settings.categories,
            copy: getTicketMessages(config.defaultLanguage),
            managedUrl: siteUrl,
        }),
        options
    )
}
