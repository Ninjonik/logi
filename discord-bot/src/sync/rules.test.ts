import assert from "node:assert/strict";
import test from "node:test";

import { shouldSyncEvent, shouldWriteMinimalConcludedSyncState } from "./rules";
import type { SyncState } from "../types";

const state: SyncState = {
  id: "state-1",
  eventId: "event-1",
  guildId: "guild-1",
  topicMessageIds: [],
  lastEventUpdatedAt: "event-v1",
  lastRosterUpdatedAt: "roster-v1",
  lastConfigUpdatedAt: "config-v1",
  scheduledEventStatus: "scheduled",
  scheduledEventId: "scheduled-1",
};

test("shouldSyncEvent syncs when no state exists", () => {
  assert.equal(shouldSyncEvent({
    event: { updatedAt: "event-v1" },
    rosterUpdatedAt: "roster-v1",
    configUpdatedAt: "config-v1",
    desiredScheduledEventStatus: "scheduled",
    meetingChannelConfigured: true,
    queued: false,
  }), true);
});

test("shouldSyncEvent skips when timestamps and scheduled state match", () => {
  assert.equal(shouldSyncEvent({
    event: { updatedAt: "event-v1" },
    rosterUpdatedAt: "roster-v1",
    configUpdatedAt: "config-v1",
    state,
    desiredScheduledEventStatus: "scheduled",
    meetingChannelConfigured: true,
    queued: false,
  }), false);
});

test("shouldSyncEvent detects event, roster, and config changes", () => {
  assert.equal(shouldSyncEvent({
    event: { updatedAt: "event-v2" },
    rosterUpdatedAt: "roster-v1",
    configUpdatedAt: "config-v1",
    state,
    desiredScheduledEventStatus: "scheduled",
    meetingChannelConfigured: true,
    queued: false,
  }), true);

  assert.equal(shouldSyncEvent({
    event: { updatedAt: "event-v1" },
    rosterUpdatedAt: "roster-v2",
    configUpdatedAt: "config-v1",
    state,
    desiredScheduledEventStatus: "scheduled",
    meetingChannelConfigured: true,
    queued: false,
  }), true);

  assert.equal(shouldSyncEvent({
    event: { updatedAt: "event-v1" },
    rosterUpdatedAt: "roster-v1",
    configUpdatedAt: "config-v2",
    state,
    desiredScheduledEventStatus: "scheduled",
    meetingChannelConfigured: true,
    queued: false,
  }), true);
});

test("shouldSyncEvent detects queued events and scheduled event mismatches", () => {
  assert.equal(shouldSyncEvent({
    event: { updatedAt: "event-v1" },
    rosterUpdatedAt: "roster-v1",
    configUpdatedAt: "config-v1",
    state,
    desiredScheduledEventStatus: "active",
    meetingChannelConfigured: true,
    queued: false,
  }), true);

  assert.equal(shouldSyncEvent({
    event: { updatedAt: "event-v1" },
    rosterUpdatedAt: "roster-v1",
    configUpdatedAt: "config-v1",
    state,
    desiredScheduledEventStatus: "scheduled",
    meetingChannelConfigured: true,
    queued: true,
  }), true);
});

test("shouldSyncEvent syncs when scheduled event should exist or should be cleared", () => {
  assert.equal(shouldSyncEvent({
    event: { updatedAt: "event-v1" },
    rosterUpdatedAt: "roster-v1",
    configUpdatedAt: "config-v1",
    state: { ...state, scheduledEventId: undefined },
    desiredScheduledEventStatus: "scheduled",
    meetingChannelConfigured: true,
    queued: false,
  }), true);

  assert.equal(shouldSyncEvent({
    event: { updatedAt: "event-v1" },
    rosterUpdatedAt: "roster-v1",
    configUpdatedAt: "config-v1",
    state,
    desiredScheduledEventStatus: undefined,
    meetingChannelConfigured: false,
    queued: false,
  }), true);
});

test("shouldSyncEvent does not require creating completed or canceled scheduled events", () => {
  const stateWithoutScheduledEvent = {
    ...state,
    scheduledEventId: undefined,
    scheduledEventStatus: "completed" as const,
  };

  assert.equal(shouldSyncEvent({
    event: { updatedAt: "event-v1" },
    rosterUpdatedAt: "roster-v1",
    configUpdatedAt: "config-v1",
    state: stateWithoutScheduledEvent,
    desiredScheduledEventStatus: "completed",
    meetingChannelConfigured: true,
    queued: false,
  }), false);
});

test("shouldWriteMinimalConcludedSyncState only applies to unqueued concluded events without state", () => {
  assert.equal(shouldWriteMinimalConcludedSyncState({
    event: { id: "event-1", status: "concluded" },
    queued: false,
  }), true);

  assert.equal(shouldWriteMinimalConcludedSyncState({
    event: { id: "event-1", status: "concluded" },
    state,
    queued: false,
  }), false);

  assert.equal(shouldWriteMinimalConcludedSyncState({
    event: { id: "event-1", status: "concluded" },
    queued: true,
  }), false);
});
