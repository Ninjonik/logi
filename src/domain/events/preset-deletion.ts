import { currentEventStatus } from "./status"
import type { EventStatus } from "./types"

type TopicPresetReference = {
    topicPresetId?: string
    createForumChannel?: boolean
    status?: EventStatus
    registrationEnd?: string
    meetingStart?: string
    gameEnd?: string
}

/**
 * Events that still read a topic preset: the bot copies its topics into the
 * event forum and an admin can resync them until the event is concluded.
 * Concluded events keep the topics they already posted.
 */
export function eventsBlockingTopicPresetDeletion<
    T extends TopicPresetReference,
>(events: readonly T[], presetId: string, now: Date = new Date()): T[] {
    return events.filter(
        (event) =>
            event.topicPresetId === presetId &&
            currentEventStatus(event, now) !== "concluded"
    )
}
