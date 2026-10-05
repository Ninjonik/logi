import {
    buildCalendarPanelEmbed,
    buildTicketPanelComponents,
    buildTicketPanelEmbed,
} from "../message-builders"
import { publishManagedMessage } from "./publication"
import { convex, references } from "../convex"
import type { SyncPayload } from "../types"
import type { Client } from "discord.js"
import { env } from "../environment"

export async function syncTicketPanel(client: Client, payload: SyncPayload) {
    const settings = payload.config.ticketSettings
    const embed = buildTicketPanelEmbed(payload.config)
    if (
        !settings?.enabled ||
        !settings.submitChannelId ||
        !settings.ticketParentChannelId ||
        !settings.categories.length ||
        !embed
    )
        return
    const messageId = await publishManagedMessage(client, {
        guildId: payload.config.guildId,
        key: "ticket",
        revision: Date.parse(payload.config.updatedAt),
        channelId: settings.submitChannelId,
        legacyChannelId: settings.submitChannelId,
        legacyMessageId: payload.config.ticketPanelMessageId,
        message: {
            embeds: [embed],
            components: buildTicketPanelComponents(payload.config),
        },
    })
    if (
        messageId &&
        (messageId !== payload.config.ticketPanelMessageId ||
            payload.config.ticketPanelLastConfigUpdatedAt !==
                payload.config.updatedAt)
    )
        await convex.mutation(references.updateTicketPanelState, {
            secret: env.internalSecret,
            guildId: payload.config.guildId,
            ticketPanelMessageId: messageId,
            ticketPanelLastConfigUpdatedAt: payload.config.updatedAt,
        })
}

export async function syncCalendarPanel(client: Client, payload: SyncPayload) {
    const config = payload.config
    const messageId = await publishManagedMessage(client, {
        guildId: config.guildId,
        key: "calendar",
        revision: Date.parse(config.updatedAt),
        channelId: config.calendarChannelId ?? null,
        legacyChannelId: config.calendarMessageChannelId,
        legacyMessageId: config.calendarMessageId,
        message: {
            embeds: [
                buildCalendarPanelEmbed(
                    config,
                    payload.guild.eventCategories,
                    payload.events,
                    payload.calendarItems
                ),
            ],
            components: [],
        },
    })
    if (
        (messageId ?? undefined) !== config.calendarMessageId ||
        config.calendarChannelId !== config.calendarMessageChannelId ||
        config.calendarMessageLastConfigUpdatedAt !== config.updatedAt
    )
        await convex.mutation(references.updateCalendarPanelState, {
            secret: env.internalSecret,
            guildId: config.guildId,
            calendarMessageChannelId: config.calendarChannelId,
            calendarMessageId: messageId ?? undefined,
            calendarMessageLastConfigUpdatedAt: config.updatedAt,
        })
}
