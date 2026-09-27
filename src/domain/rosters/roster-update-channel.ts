type RosterUpdateChannelInput = {
    eventAnnouncementChannelId?: string
    eventInfoChannelId?: string
    configuredAnnouncementChannelId?: string
    configuredEventInfoChannelId?: string
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
