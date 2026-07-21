import type { EventRecord, SyncState } from "../types";

export function shouldWriteMinimalConcludedSyncState(input: {
  event: Pick<EventRecord, "id" | "status">;
  state?: SyncState;
  queued: boolean;
}) {
  return input.event.status === "concluded" && !input.state && !input.queued;
}

export function shouldSyncEvent(input: {
  event: Pick<EventRecord, "updatedAt">;
  rosterUpdatedAt?: string;
  configUpdatedAt: string;
  state?: SyncState;
  desiredScheduledEventStatus?: SyncState["scheduledEventStatus"];
  meetingChannelConfigured: boolean;
  queued: boolean;
}) {
  const {
    event,
    rosterUpdatedAt,
    configUpdatedAt,
    state,
    desiredScheduledEventStatus,
    meetingChannelConfigured,
    queued,
  } = input;

  return (
    !state ||
    state.lastEventUpdatedAt !== event.updatedAt ||
    state.lastRosterUpdatedAt !== rosterUpdatedAt ||
    state.lastConfigUpdatedAt !== configUpdatedAt ||
    state.scheduledEventStatus !== desiredScheduledEventStatus ||
    (
      meetingChannelConfigured
        ? !state.scheduledEventId &&
          desiredScheduledEventStatus !== "completed" &&
          desiredScheduledEventStatus !== "canceled"
        : Boolean(state.scheduledEventId)
    ) ||
    queued
  );
}
