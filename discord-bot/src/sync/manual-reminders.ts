import type { Client } from "discord.js"

import {
    buildAttendanceReminderDm,
    leaderNames,
    rosterPlaces,
} from "./attendance-reminders"
import { buildSignupReminderMessage } from "./signup-reminders"
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

/** How a manual reminder went: DMs Discord accepted and players it refused. */
export type ManualReminderDelivery = { sent: number; failedUserIds: string[] }

/**
 * The DM each recipient of a manual reminder gets (board L2-23..27): members
 * who have not answered get the sign-up reminder, roster players and
 * reserves who have not confirmed get the attendance reminder with their
 * place. Both say "Připomínku poslalo velení z Logi." and use the clan
 * colour. Players whose DMs Discord refuses are returned for the match page
 * (board L2-60); they are never reported to the errors channel.
 */
export async function deliverManualReminder(input: {
    payload: SyncPayload
    request: ClaimedManualReminder
    send: Send
    names?: Readonly<Record<string, string>>
    now?: number
}): Promise<ManualReminderDelivery> {
    const { payload, request } = input
    const event = payload.events.find((item) => item.id === request.eventId)
    const delivery: ManualReminderDelivery = { sent: 0, failedUserIds: [] }
    if (!event || !request.recipientIds.length) return delivery

    const record = async (userId: string, message: unknown) => {
        if (await input.send(userId, message)) delivery.sent += 1
        else delivery.failedUserIds.push(userId)
    }

    if (request.audience === "unanswered") {
        const message = buildSignupReminderMessage(payload, event, {
            sentByLeaders: true,
        })
        for (const userId of request.recipientIds) await record(userId, message)
        return delivery
    }

    const roster = payload.rosters.find((item) => item.eventId === event.id)
    const places = roster
        ? rosterPlaces(roster, input.names ?? payload.userDisplayNames, {
              includeAcknowledged: true,
          })
        : new Map()
    for (const userId of request.recipientIds)
        await record(
            userId,
            buildAttendanceReminderDm({
                payload,
                event,
                place: places.get(userId),
                now: input.now ?? Date.now(),
                sentByLeaders: true,
            })
        )
    return delivery
}

/** Leader names for the attendance reminder, read from the clan's guild. */
export async function manualReminderNames(
    client: Client,
    payload: SyncPayload,
    eventId: string
) {
    const roster = payload.rosters.find((item) => item.eventId === eventId)
    if (!roster) return payload.userDisplayNames
    const guild = await client.guilds
        .fetch(payload.config.guildId)
        .catch(() => null)
    return await leaderNames(guild, roster, payload.userDisplayNames)
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
