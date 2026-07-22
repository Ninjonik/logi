import type { SyncEventLike, SyncScheduledStatus, SyncStateLike } from "./types";

export function shouldWriteMinimalConcludedSyncState(input: {
  event: Pick<SyncEventLike, "id" | "status">;
  state?: SyncStateLike;
  queued: boolean;
}) {
  return input.event.status === "concluded" && !input.state && !input.queued;
}

export function shouldSyncEvent(input: {
  event: Pick<SyncEventLike, "updatedAt">;
  rosterUpdatedAt?: string;
  configUpdatedAt: string;
  state?: SyncStateLike;
  desiredScheduledEventStatus?: SyncScheduledStatus;
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

export function deriveScheduledEventLifecycle(
  event: Pick<SyncEventLike, "meetingStart" | "gameEnd" | "status">,
  now?: Date,
): SyncScheduledStatus {
  const nowValue = now ? now.getTime() : Date.now();
  const meetingStart = new Date(event.meetingStart).getTime();
  const gameEnd = new Date(event.gameEnd).getTime();

  if (event.status === "concluded") {
    return Number.isFinite(meetingStart) && nowValue < meetingStart ? "canceled" : "completed";
  }
  if (Number.isFinite(gameEnd) && nowValue >= gameEnd) {
    return "completed";
  }
  if (Number.isFinite(meetingStart) && nowValue >= meetingStart) {
    return "active";
  }

  return "scheduled";
}
