import assert from "node:assert/strict"
import test from "node:test"

import {
    resolveRosterUpdateChannelIds,
    rosterCardHome,
} from "./roster-update-channel"

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

test("the roster card is its own message with a roster channel, else the announcement (L1-43, D5-08)", () => {
    assert.equal(
        rosterCardHome({
            configuredAnnouncementChannelId: "announcements",
            configuredEventInfoChannelId: "info",
        }),
        "roster-channel"
    )
    assert.equal(
        rosterCardHome({ configuredAnnouncementChannelId: "announcements" }),
        "announcement"
    )
    // The event's snapshotted routing wins over the clan's settings.
    assert.equal(
        rosterCardHome({
            eventAnnouncementChannelId: "event-announcements",
            configuredAnnouncementChannelId: "announcements",
            configuredEventInfoChannelId: "info",
        }),
        "roster-channel"
    )
    assert.equal(
        rosterCardHome({
            kind: "training",
            configuredAnnouncementChannelId: "announcements",
        }),
        null
    )
    assert.equal(rosterCardHome({}), null)
})
