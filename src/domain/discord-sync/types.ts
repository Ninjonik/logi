export type SyncScheduledStatus =
    "scheduled" | "active" | "completed" | "canceled"

export type SyncEventLike = {
    id: string
    updatedAt: string
    status: "registration" | "closed" | "starting" | "concluded"
    meetingStart: string
    gameEnd: string
    /** When the match was ended; before its meeting means it was cancelled. */
    concludedAt?: string
}

export type SyncRosterLike = {
    eventId: string
    updatedAt: string
}

export type SyncStateLike = {
    scheduledEventId?: string
    scheduledEventStatus?: SyncScheduledStatus
    lastEventUpdatedAt?: string
    lastRosterUpdatedAt?: string
    lastConfigUpdatedAt?: string
    eventInfoMessageId?: string
    eventInfoMessageRenderVersion?: string
}
