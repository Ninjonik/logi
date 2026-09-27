import assert from "node:assert/strict"
import test from "node:test"

import { resolveRosterUpdateChannelIds } from "./roster-update-channel"

test("roster updates retain the event-info channel after an event-specific route is set", () => {
    assert.deepEqual(
        resolveRosterUpdateChannelIds({
            eventAnnouncementChannelId: "event-registration",
            eventInfoChannelId: "event-info",
            configuredAnnouncementChannelId: "default-registration",
            configuredEventInfoChannelId: "default-info",
        }),
        {
            announcementChannelId: "event-registration",
            eventInfoChannelId: "event-info",
            rosterUpdateChannelId: "event-info",
        }
    )
})

test("roster updates fall back to the registration channel for a single-channel event", () => {
    assert.deepEqual(
        resolveRosterUpdateChannelIds({
            eventAnnouncementChannelId: "event-registration",
        }),
        {
            announcementChannelId: "event-registration",
            eventInfoChannelId: undefined,
            rosterUpdateChannelId: "event-registration",
        }
    )
})
