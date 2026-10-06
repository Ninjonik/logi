type RosterUpdateChannelInput = {
    eventAnnouncementChannelId?: string
    eventInfoChannelId?: string
    configuredAnnouncementChannelId?: string
    configuredEventInfoChannelId?: string
}

/**
 * Where a match's published roster card lives (L1-43, D5-08): its own
 * message in the roster channel when the clan has one, else the match
 * announcement itself. Trainings have no roster card; nothing without an
 * announcement channel either. Mirrors the bot's split-channel rule.
 */
export function rosterCardHome(
    input: RosterUpdateChannelInput & { kind?: "match" | "training" }
): "roster-channel" | "announcement" | null {
    if ((input.kind ?? "match") !== "match") return null
    const { announcementChannelId, eventInfoChannelId } =
        resolveRosterUpdateChannelIds(input)
    if (!announcementChannelId) return null
    return eventInfoChannelId ? "roster-channel" : "announcement"
}

/**
 * Roster updates belong beside the event details when that channel is
 * configured. Event-level routing is intentionally retained after the event
 * starts; it falls back to the registration channel only for single-channel
 * configurations.
 */
export function resolveRosterUpdateChannelIds(input: RosterUpdateChannelInput) {
    const announcementChannelId =
        input.eventAnnouncementChannelId ??
        input.configuredAnnouncementChannelId
    const eventInfoChannelId =
        input.eventInfoChannelId ?? input.configuredEventInfoChannelId

    return {
        announcementChannelId,
        eventInfoChannelId,
        rosterUpdateChannelId: eventInfoChannelId ?? announcementChannelId,
    }
}
