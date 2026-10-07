import {
    isRequestPending,
    type PanelAttempt,
} from "../../../src/domain/discord-publications/panel-delivery"
import { isPanelPaused } from "../../../src/domain/discord-publications/settings"
import { buildTicketPanelMessage } from "../interactions/tickets-panel"
import { classifyPanelError } from "../public-panels/panel-errors"
import { buildCalendarPanelView } from "../public-panels/calendar"
import { makeFunctionReference } from "convex/server"
import { publishManagedMessage } from "./publication"
import { messagePayload } from "../ui/message-kit"
import { convex, references } from "../convex"
import type { SyncPayload } from "../types"
import type { Client } from "discord.js"
import { env } from "../environment"

export async function syncTicketPanel(client: Client, payload: SyncPayload) {
    const settings = payload.config.ticketSettings
    const message = buildTicketPanelMessage(payload.config)
    if (
        !settings?.enabled ||
        !settings.submitChannelId ||
        !settings.ticketParentChannelId ||
        !settings.categories.length ||
        !message
    )
        return
    const messageId = await publishManagedMessage(client, {
        guildId: payload.config.guildId,
        key: "ticket",
        revision: Date.parse(payload.config.updatedAt),
        channelId: settings.submitChannelId,
        legacyChannelId: settings.submitChannelId,
        legacyMessageId: payload.config.ticketPanelMessageId,
        message,
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

type CalendarPanelRow = {
    _id: string
    channelId: string
    enabled: boolean
    paused?: boolean
    draft?: boolean
    removing?: boolean
    title?: string
    calendarCategories?: string[]
    presentation?: { accentColor?: string | null } | null
    requestedAt?: number
    revision: number
    handledRequestAt: number | null
}

/**
 * The calendar panel (L3-12..18): Components V2 in the clan frame, kept under
 * the key of the old calendar message so it is edited, not reposted. With a
 * "Kalendář" panel in "Panely v Discordu" its channel, categories, pause and
 * requests apply; without one the channel from "Kanály a jazyk" does.
 */
export async function syncCalendarPanel(client: Client, payload: SyncPayload) {
    const config = payload.config
    const panel = await convex
        .query(
            makeFunctionReference<"query">("discordPanelBot:calendarPanel"),
            {
                secret: env.internalSecret,
                guildId: config.guildId,
            }
        )
        .then((row) => row as CalendarPanelRow | null)
        .catch(() => undefined)
    const requested = panel
        ? isRequestPending(panel.requestedAt, panel.handledRequestAt)
        : false
    // A paused calendar keeps its message as it is ("Pozastaveno", P1-22).
    if (panel && isPanelPaused(panel) && !requested) return
    const now = Date.now()
    const channelId = panel
        ? panel.draft || panel.removing
            ? null
            : panel.channelId
        : (config.calendarChannelId ?? null)
    const report = (attempt: PanelAttempt) =>
        panel
            ? convex
                  .mutation(
                      makeFunctionReference<"mutation">(
                          "discordPanelBotWrites:report"
                      ),
                      {
                          secret: env.internalSecret,
                          guildId: config.guildId,
                          panelId: panel._id,
                          attempt,
                      }
                  )
                  .catch(() => undefined)
            : undefined
    let messageId: string | null | undefined
    try {
        messageId = await publishManagedMessage(client, {
            guildId: config.guildId,
            key: "calendar",
            revision: Math.max(
                Date.parse(config.updatedAt) || 0,
                panel?.revision ?? 0
            ),
            channelId,
            legacyChannelId: config.calendarMessageChannelId,
            legacyMessageId: config.calendarMessageId,
            message: messagePayload(
                buildCalendarPanelView(payload, {
                    now,
                    siteUrl: env.appSiteUrl,
                    categories:
                        panel?.calendarCategories ??
                        config.calendarCategories ??
                        [],
                    title: panel?.title ?? null,
                    accentColor: panel?.presentation?.accentColor ?? null,
                }),
                {
                    language: config.defaultLanguage,
                    style: config.messageStyle,
                }
            ),
        })
    } catch (error) {
        await report({
            attemptAt: now,
            ok: false,
            error: classifyPanelError(error, now) ?? {
                code: "unknown",
                at: now,
            },
            nextAt: null,
            dataAt: null,
            handledRequestAt: requested ? (panel?.requestedAt ?? null) : null,
            warnings: [],
            messages: 0,
        })
        throw error
    }
    await report({
        attemptAt: now,
        ok: true,
        error: null,
        nextAt: null,
        dataAt: now,
        handledRequestAt: requested ? (panel?.requestedAt ?? null) : null,
        warnings: [],
        messages: channelId && messageId ? 1 : 0,
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
