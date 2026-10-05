import type { ClanLanguage, EventRecord } from "../../../discord-bot/src/types"
import { getEventMessages } from "@/lib/clan-language/events"

export function buildScheduledEventDescription(
    event: EventRecord,
    language: ClanLanguage
) {
    const messages = getEventMessages(language)
    const lines = [
        event.description?.trim(),
        event.notes?.trim(),
        event.kind === "match" && event.map
            ? `${messages.scheduledEvent.map}: ${event.map}`
            : null,
        event.kind === "match" && event.side
            ? `${messages.scheduledEvent.side}: ${event.side}`
            : null,
        event.kind === "match" && event.cap
            ? `${messages.scheduledEvent.cap}: ${event.cap}`
            : null,
        event.server
            ? `${messages.scheduledEvent.server}: ${event.server}`
            : null,
        // Every guild member can read a scheduled event, so the server
        // password is left to the player's private "My assignment" reply.
    ].filter((line): line is string => Boolean(line))

    return (
        lines.join("\n").slice(0, 1000) ||
        messages.scheduledEvent.managedFallback
    )
}

export function resolveScheduledEventEndTime(
    event: Pick<EventRecord, "meetingStart" | "gameEnd">
) {
    const scheduledStartTime = new Date(event.meetingStart)
    const scheduledEndTime = new Date(event.gameEnd)

    if (
        Number.isFinite(scheduledStartTime.getTime()) &&
        Number.isFinite(scheduledEndTime.getTime()) &&
        scheduledEndTime.getTime() > scheduledStartTime.getTime()
    ) {
        return scheduledEndTime
    }

    return new Date(scheduledStartTime.getTime() + 90 * 60 * 1000)
}
