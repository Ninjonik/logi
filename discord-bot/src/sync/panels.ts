import {
    buildCalendarPanelEmbed,
    buildMembershipPanelComponents,
    buildMembershipPanelEmbed,
    buildTicketPanelComponents,
    buildTicketPanelEmbed,
} from "../message-builders"
import { membershipPanelConfig } from "../../../src/domain/discord-publications/legacy-bindings"
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

export async function syncMembershipPanel(
    client: Client,
    payload: SyncPayload
) {
    for (const gameId of [
        "hell_let_loose",
        "hell_let_loose_vietnam",
        "wardogs",
    ] as const) {
        const override = payload.config.gameOverrides?.[gameId]
        if (!override?.membershipSettings && gameId !== "hell_let_loose")
            continue
        const config = override?.membershipSettings
            ? membershipPanelConfig(payload.config, override)
            : payload.config
        const settings = config.membershipSettings
        const embed = buildMembershipPanelEmbed(config)
        if (
            !settings?.enabled ||
            !settings.submitChannelId ||
            !settings.applicationParentChannelId ||
            !settings.categories.length ||
            !embed
        )
            continue
        const messageId = await publishManagedMessage(client, {
            guildId: config.guildId,
            key: `membership:${gameId}`,
            revision: Date.parse(config.updatedAt),
            channelId: settings.submitChannelId,
            legacyChannelId: settings.submitChannelId,
            legacyMessageId: config.membershipPanelMessageId,
            message: {
                embeds: [embed],
                components: buildMembershipPanelComponents(config, gameId),
            },
        })
        if (
            messageId &&
            (messageId !== config.membershipPanelMessageId ||
                config.membershipPanelLastConfigUpdatedAt !== config.updatedAt)
        )
            await convex.mutation(references.updateMembershipPanelState, {
                secret: env.internalSecret,
                guildId: config.guildId,
                gameId,
                membershipPanelMessageId: messageId,
                membershipPanelLastConfigUpdatedAt: config.updatedAt,
            })
    }
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
