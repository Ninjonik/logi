import { MessageFlags, type Client } from "discord.js"

import { isRegistrationAnnouncementDue } from "../../../src/domain/events/registration-announcement"
import { resolveSignupReminderStatuses } from "../../../src/domain/events/scheduled-job-policy"
import {
    announcementMessage,
    buildAnnouncementCard,
} from "../events/announcement"
import { matchesGameScope } from "../../../src/domain/games/game"
import type { SyncPayload } from "../types"
import { logInfo } from "../log"

function getRecipientStatus(input: {
    type: "member" | "reserve_member" | "mercenary"
    status: "pending" | "recruit" | "active"
}) {
    if (input.type === "reserve_member" && input.status === "active") {
        return "reserve_member" as const
    }
    if (input.type === "member" && input.status === "recruit") {
        return "recruit" as const
    }
    if (input.type === "member" && input.status === "active") {
        return "member" as const
    }
    return null
}

export function isSignupReminderRecipient(input: {
    assignment: SyncPayload["assignments"][number]
    eventGameId: SyncPayload["events"][number]["gameId"]
    recipientStatuses: ReadonlySet<"recruit" | "member" | "reserve_member">
    respondedUserIds: ReadonlySet<string>
}) {
    const status = getRecipientStatus(input.assignment)
    return (
        matchesGameScope(input.assignment.gameId, input.eventGameId) &&
        status !== null &&
        input.recipientStatuses.has(status) &&
        !input.respondedUserIds.has(input.assignment.userId)
    )
}

/**
 * The sign-up reminder DM: the match announcement card with its sign-up
 * buttons, which work inside the DM (board L1-87). Used by the scheduled
 * reminder and by reminders leadership sends from the dashboard or with
 * "Připomenout bez odpovědi". The DM's own look (board L2) is the DM
 * workstream's.
 */
export function buildSignupReminderMessage(
    payload: SyncPayload,
    event: SyncPayload["events"][number]
) {
    const syncState = payload.syncStates.find(
        (state) => state.eventId === event.id
    )
    const { view } = buildAnnouncementCard(payload, event, {
        forumChannelId: syncState?.forumChannelId,
        announcementChannelId:
            event.announcementChannelId ??
            payload.config.announcementsChannelId,
    })
    return announcementMessage(view, { config: payload.config })
}

export async function processSignupReminders(
    client: Client,
    payload: SyncPayload,
    dueEventIds: ReadonlySet<string>
) {
    for (const event of payload.events) {
        if (
            !dueEventIds.has(event.id) ||
            event.kind !== "match" ||
            event.status !== "registration" ||
            !isRegistrationAnnouncementDue(event)
        ) {
            continue
        }
        const recipientStatuses = new Set(
            resolveSignupReminderStatuses(event.signupReminderStatuses)
        )
        if (!recipientStatuses.size) continue

        const respondedUserIds = new Set(
            event.participants.map((participant) => participant.userId)
        )
        const message = buildSignupReminderMessage(payload, event)
        // Assignments were not included in older cached payloads. Treat them
        // as an empty recipient set while a rolling deployment catches up.
        const recipients = (payload.assignments ?? []).filter((assignment) =>
            isSignupReminderRecipient({
                assignment,
                eventGameId: event.gameId,
                recipientStatuses,
                respondedUserIds,
            })
        )
        for (const recipient of recipients) {
            const user = await client.users
                .fetch(recipient.userId)
                .catch(() => null)
            if (!user) continue
            await user
                .send({ ...message, flags: MessageFlags.IsComponentsV2 })
                .then(() =>
                    logInfo("signup-reminders", "Sent signup reminder", {
                        eventId: event.id,
                        guildId: payload.config.guildId,
                        userId: recipient.userId,
                    })
                )
                .catch(() => undefined)
        }
    }
}
