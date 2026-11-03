/** Explicit destinations; missing destination preserves the legacy private debrief. */
export type DebriefDestination =
    "event_forum" | "results_thread" | "debrief_forum" | "private_thread"
export type EventDiscussionSettings = {
    createForumChannel?: boolean
    createDebriefThread?: boolean
    deleteForumAfterConclusion?: boolean
    debriefDestination?: DebriefDestination
    debriefForumChannelId?: string
}

/** A debrief must survive event-forum cleanup. Shared by every event writer. */
export function validateEventDiscussion(settings: EventDiscussionSettings) {
    if (settings.createDebriefThread === false) return
    if (
        settings.debriefDestination === "event_forum" &&
        (!settings.createForumChannel || settings.deleteForumAfterConclusion)
    )
        throw new Error(
            "An event-forum debrief requires a retained event forum."
        )
    if (
        settings.debriefDestination === "debrief_forum" &&
        !settings.debriefForumChannelId?.trim()
    )
        throw new Error("Select a debrief forum channel.")
}

/** Snapshot defaults at creation; subsequent clan changes never move existing discussions. */
export function eventDiscussionDefaults(
    config:
        | {
              eventDiscussionDefaults?: EventDiscussionSettings
              gameOverrides?: Partial<
                  Record<
                      string,
                      { eventDiscussionDefaults?: EventDiscussionSettings }
                  >
              >
          }
        | null
        | undefined,
    gameId: string
): EventDiscussionSettings {
    return {
        ...config?.eventDiscussionDefaults,
        ...config?.gameOverrides?.[gameId]?.eventDiscussionDefaults,
    }
}
