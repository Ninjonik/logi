import type { Client } from "discord.js"

import { isRegistrationAnnouncementDue } from "../../../src/domain/events/registration-announcement"
import { resolveSignupReminderStatuses } from "../../../src/domain/events/scheduled-job-policy"
import { signupReminderView } from "../../../src/domain/discord-messages/direct-message-views"
import { getDirectMessages } from "../../../src/lib/clan-language/direct-messages"
import { dmFrame, eventCategory, eventMapLabel } from "../events/match-context"
import { matchTitle } from "../../../src/domain/discord-messages/match-text"
import { getRosterMessages } from "../../../src/lib/clan-language/rosters"
import { matchesGameScope } from "../../../src/domain/games/game"
import { SIGNUP_NOT_ATTENDING } from "../constants"
import { messagePayload } from "../ui/message-kit"
import { buildDiscordMessageLink } from "../utils"
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
 * The sign-up reminder DM (board L2-06..15): "Připomínka přihlášky" with the
 * match, its sides, the weekday start, the sign-up deadline, why the DM came
 * and "Přihlásit se", "Nepřijdu" and "Otevřít ohlášení", which answer in the
 * same DM. Used by the scheduled reminder and by reminders leadership sends
 * from the dashboard or with "Připomenout bez odpovědi" under "Zobrazit
 * přihlášené" ("Připomínku poslalo velení z Logi.").
 */
export function buildSignupReminderMessage(
    payload: SyncPayload,
    event: SyncPayload["events"][number],
    options: { sentByLeaders?: boolean } = {}
) {
    const syncState = payload.syncStates.find(
        (state) => state.eventId === event.id
    )
    const language = payload.config.defaultLanguage
    const guildId = payload.config.guildId
    const announcementUrl =
        buildDiscordMessageLink(
            guildId,
            syncState?.announcementChannelId ??
                event.announcementChannelId ??
                payload.config.announcementsChannelId,
            syncState?.announcementMessageId
        ) ?? undefined
    return messagePayload(
        signupReminderView({
            event: {
                id: event.id,
                title: matchTitle(event),
                category: eventCategory(event, payload.guild.eventCategories),
                teams: event.matchTeams,
                side: event.side,
                mapLabel: eventMapLabel(event, language),
                registrationEnd: event.registrationEnd,
                meetingStart: event.meetingStart,
                gameStart: event.gameStart,
            },
            // The same sign-up buttons as the announcement; they answer in the
            // DM ("Přihlásit se" opens the group picker there, board L1-87).
            ids: {
                signUp: `signup-picker:${event.id}:${guildId}`,
                decline: `signup:${event.id}:${encodeURIComponent(SIGNUP_NOT_ATTENDING)}:${guildId}`,
            },
            announcementUrl,
            sentByLeaders: options.sentByLeaders,
            copy: getDirectMessages(language),
            rosterCopy: getRosterMessages(language),
            frame: dmFrame(payload.config, payload.guild.name),
        }),
        { language, style: payload.config.messageStyle }
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
                .send(message)
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
