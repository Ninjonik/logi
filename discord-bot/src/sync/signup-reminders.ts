import type { Client } from "discord.js"

import { matchesGameScope } from "../../../src/domain/games/game"
import { resolveSignupReminderStatuses } from "../../../src/domain/events/scheduled-job-policy"
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

export function isSignupReminderRecipient(input: {
    assignment: SyncPayload["assignments"][number]
    eventGameId: SyncPayload["events"][number]["gameId"]
    recipientStatuses: ReadonlySet<
        "recruit" | "member" | "reserve_member"
    >
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
        const recipientStatuses = new Set(
            resolveSignupReminderStatuses(event.signupReminderStatuses)
        )
        if (!recipientStatuses.size) continue

        const respondedUserIds = new Set(
            event.participants.map((participant) => participant.userId)
        )

        const { embed, components } = buildAnnouncementMessage(payload, event)
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
