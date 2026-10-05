import { MessageFlags, type Client } from "discord.js"

import { resolveMessageAccentColor } from "../../../src/domain/discord-messages/format"
import { getClanDiscordMessages } from "../../../src/lib/clan-language"
import { buildAttendanceReminderMessage } from "./attendance-reminders"
import { buildAttendanceReminderComponents } from "../message-builders"
import { buildSignupReminderMessage } from "./signup-reminders"
import { buildDiscordMessageLink } from "../utils"
import type { SyncPayload } from "../types"
import { logInfo } from "../log"

export type ClaimedManualReminder = {
    id: string
    eventId: string
    guildId: string
    audience: "unanswered" | "unconfirmed"
    recipientIds: string[]
}

type Send = (userId: string, message: unknown) => Promise<boolean>

/**
 * The DM each recipient of a manual reminder gets: members who have not
 * answered get the sign-up reminder, roster players and reserves who have not
 * confirmed get the attendance reminder with their place and the confirm and
 * running-late buttons. Returns how many DMs Discord accepted.
 */
export async function deliverManualReminder(input: {
    payload: SyncPayload
    request: ClaimedManualReminder
    send: Send
}): Promise<number> {
    const { payload, request } = input
    const event = payload.events.find((item) => item.id === request.eventId)
    if (!event || !request.recipientIds.length) return 0

    if (request.audience === "unanswered") {
        const message = buildSignupReminderMessage(payload, event)
        let sent = 0
        for (const userId of request.recipientIds) {
            if (
                await input.send(userId, {
                    ...message,
                    flags: MessageFlags.IsComponentsV2,
                })
            )
                sent += 1
        }
        return sent
    }

    const messages = getClanDiscordMessages(payload.config.defaultLanguage)
    const roster = payload.rosters.find((item) => item.eventId === event.id)
    const places = new Map<
        string,
        { squadName: string; roleName?: string; note?: string }
    >()
    for (const squad of roster?.squads ?? []) {
        for (const player of squad.players) {
            if (player.id)
                places.set(player.id, {
                    squadName: squad.name,
                    roleName: player.roleName,
                    note: player.note,
                })
        }
    }
    for (const userId of roster?.reservePlayerIds ?? []) {
        if (!places.has(userId))
            places.set(userId, { squadName: messages.assignment.reserveTitle })
    }
    const syncState = payload.syncStates.find(
        (item) => item.eventId === event.id
    )
    const eventMessageUrl =
        buildDiscordMessageLink(
            payload.config.guildId,
            event.eventInfoChannelId ?? payload.config.eventInfoChannelId,
            syncState?.eventInfoMessageId
        ) ??
        buildDiscordMessageLink(
            payload.config.guildId,
            syncState?.announcementChannelId,
            syncState?.announcementMessageId
        ) ??
        undefined
    const matchType = event.matchType?.trim().toLowerCase()
    const accentColor = resolveMessageAccentColor({
        categoryColor: matchType
            ? payload.guild.eventCategories?.find(
                  (category) => category.id.trim().toLowerCase() === matchType
              )?.color
            : undefined,
    })
    const meetingStartMs = new Date(event.meetingStart).getTime()
    let sent = 0
    for (const userId of request.recipientIds) {
        const embed = buildAttendanceReminderMessage({
            eventName: event.name,
            meetingStartMs,
            gameStartMs: Date.parse(event.gameStart),
            eventMessageUrl,
            assignment: places.get(userId),
            messages,
            accentColor,
        })
        if (
            await input.send(userId, {
                embeds: [embed],
                allowedMentions: { parse: [] },
                components: buildAttendanceReminderComponents(
                    event.id,
                    payload.config.defaultLanguage
                ),
            })
        )
            sent += 1
    }
    return sent
}

/** Sends one DM through Discord; a closed DM or unknown user counts as not sent. */
export function discordDmSender(client: Client, eventId: string): Send {
    return async (userId, message) => {
        const user = await client.users.fetch(userId).catch(() => null)
        if (!user) return false
        return await user
            .send(message as Parameters<typeof user.send>[0])
            .then(() => {
                logInfo("manual-reminders", "Sent manual reminder", {
                    eventId,
                    userId,
                })
                return true
            })
            .catch(() => false)
    }
}
