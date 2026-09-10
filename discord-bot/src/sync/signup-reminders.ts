import type { Client } from "discord.js"

import { buildAnnouncementMessage } from "../message-builders"
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

export async function processSignupReminders(
    client: Client,
    payload: SyncPayload,
    dueEventIds: ReadonlySet<string>
) {
    for (const event of payload.events) {
        if (
            !dueEventIds.has(event.id) ||
            event.kind !== "match" ||
            event.status !== "registration"
        ) {
            continue
        }
        const recipientStatuses = new Set(event.signupReminderStatuses ?? [])
        if (!recipientStatuses.size) continue

        const { embed, components } = buildAnnouncementMessage(payload, event)
        const recipients = payload.assignments.filter((assignment) => {
            const status = getRecipientStatus(assignment)
            return (
                assignment.gameId === event.gameId &&
                status !== null &&
                recipientStatuses.has(status)
            )
        })
        for (const recipient of recipients) {
            const user = await client.users
                .fetch(recipient.userId)
                .catch(() => null)
            if (!user) continue
            await user
                .send({ embeds: [embed], components })
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
