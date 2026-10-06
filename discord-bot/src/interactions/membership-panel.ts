import type { Client } from "discord.js"

import {
    applicationPanelDefaults,
    getApplicationMessages,
} from "../../../src/lib/clan-language/application"
import { effectivePanelCopy } from "../../../src/domain/membership/application-panel-copy"
import { applicationWindowCount } from "../../../src/domain/membership/application-plan"
import { resolveApplicationForm } from "../../../src/domain/membership/application-form"
import { applicationPanelView } from "../../../src/domain/membership/application-views"

import { publishManagedMessage } from "../sync/publication"
import type { DiscordConfig, SyncPayload } from "../types"
import { messagePayload } from "../ui/message-kit"
import { convex, references } from "../convex"
import { revalidateAppData } from "../cache"
import { env } from "../environment"

/**
 * The application panel in `#nabor` (L6-12..L6-15, L4-05..L4-10, N4-10):
 * clan colour, the categories as lines, "Podat přihlášku" and, with the web
 * form switched on, "Vyplnit přihlášku na webu". Saving the settings
 * republishes it (N4-B07).
 */

/** The web form of Variant B (N4-42) for a clan. */
export const webApplicationUrl = (language: string, guildId: string) =>
    `${env.appSiteUrl}/${language}/apply/${guildId}`

/** Three windows when any category has clan questions, else two. */
export function panelWindowCount(config: DiscordConfig): 2 | 3 {
    const settings = config.membershipSettings
    if (!settings) return 2
    const copy = getApplicationMessages(config.defaultLanguage)
    return applicationWindowCount(
        resolveApplicationForm(
            settings.applicationForm,
            settings.categories,
            copy.defaultForm
        ),
        settings.categories
    )
}

/**
 * The panel as posted. A title or text the clan never changed shows the
 * current default in the clan language ("Přidej se ke klanu {clan}").
 */
export function buildMembershipPanelPayload(
    config: DiscordConfig,
    clanName: string
) {
    const settings = config.membershipSettings
    if (!settings?.categories.length) return null
    const copy = getApplicationMessages(config.defaultLanguage)
    const windows = panelWindowCount(config)
    const panel = effectivePanelCopy(
        {
            title: settings.panelTitle,
            text: settings.panelDescription,
            clanName,
            windows,
        },
        copy.panel,
        applicationPanelDefaults
    )
    return messagePayload(
        applicationPanelView(copy, {
            title: panel.title,
            text: panel.text,
            windowsNote: !panel.defaultText,
            imageUrl: settings.panelImageUrl,
            accentColor: settings.panelAccentColor,
            categories: settings.categories,
            windows,
            webFormUrl: settings.webFormEnabled
                ? webApplicationUrl(config.defaultLanguage, config.guildId)
                : null,
            managedUrl: env.appSiteUrl,
        }),
        { language: config.defaultLanguage, style: config.messageStyle }
    )
}

export async function syncMembershipPanel(
    client: Client,
    payload: SyncPayload
) {
    const config = payload.config
    const settings = config.membershipSettings
    const message = buildMembershipPanelPayload(config, payload.guild.name)
    if (
        !settings?.enabled ||
        !settings.submitChannelId ||
        !settings.applicationParentChannelId ||
        !settings.categories.length ||
        !message
    )
        return
    // One shared panel: window 1 asks for the games, so no per-game message.
    const messageId = await publishManagedMessage(client, {
        guildId: config.guildId,
        key: "membership",
        revision: Date.parse(config.updatedAt),
        channelId: settings.submitChannelId,
        legacyChannelId: settings.submitChannelId,
        legacyMessageId: config.membershipPanelMessageId,
        message,
    })
    if (
        messageId &&
        (messageId !== config.membershipPanelMessageId ||
            config.membershipPanelLastConfigUpdatedAt !== config.updatedAt)
    ) {
        await convex.mutation(references.updateMembershipPanelState, {
            secret: env.internalSecret,
            guildId: config.guildId,
            membershipPanelMessageId: messageId,
            membershipPanelLastConfigUpdatedAt: config.updatedAt,
        })
        await revalidateAppData({
            type: "discord-config-changed",
            serverId: config.guildId,
        })
    }
}
