import assert from "node:assert/strict";
import test from "node:test";

import { deriveScheduledEventLifecycle, shouldSyncEvent, shouldWriteMinimalConcludedSyncState } from "./rules";

test("deriveScheduledEventLifecycle derives canceled for concluded events before meeting", () => {
  assert.equal(
    deriveScheduledEventLifecycle({
      meetingStart: "2026-07-22T13:00:00.000Z",
      gameEnd: "2026-07-22T15:00:00.000Z",
      status: "concluded",
    }, new Date("2026-07-22T12:00:00.000Z")),
    "canceled",
  );
});

test("shouldSyncEvent matches current bot sync rule behavior", () => {
  assert.equal(shouldSyncEvent({
    event: { updatedAt: "event-v1" },
    rosterUpdatedAt: "roster-v1",
    configUpdatedAt: "config-v1",
    desiredScheduledEventStatus: "scheduled",
    meetingChannelConfigured: true,
    queued: false,
  }), true);
});

test("shouldSyncEvent does not require an event-info message before the roster is published", () => {
  assert.equal(shouldSyncEvent({
    event: { updatedAt: "event-v1" },
    rosterUpdatedAt: undefined,
    configUpdatedAt: "config-v1",
    state: {
      lastEventUpdatedAt: "event-v1",
      lastRosterUpdatedAt: undefined,
      lastConfigUpdatedAt: "config-v1",
      eventInfoMessageRenderVersion: "3",
    },
    meetingChannelConfigured: false,
    eventInfoChannelConfigured: true,
    eventInfoMessageRequired: false,
    queued: false,
  }), false);
});

test("shouldWriteMinimalConcludedSyncState only applies without prior state", () => {
  assert.equal(shouldWriteMinimalConcludedSyncState({
    event: { id: "event-1", status: "concluded" },
    queued: false,
  }), true);
});
