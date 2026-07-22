import type { EventKind, EventLike, EventStatus } from "./types";

export function deriveEventStatus(event: {
  registrationEnd: string;
  meetingStart: string;
  gameEnd: string;
  status?: EventStatus;
}, now: Date = new Date()): EventStatus {
  if (event.status === "concluded") {
    return "concluded";
  }

  const currentTime = now.getTime();
  const registrationEnd = new Date(event.registrationEnd).getTime();
  const meetingCountdownStart = new Date(event.meetingStart).getTime() - 24 * 60 * 60 * 1000;
  const startingAt = Number.isFinite(registrationEnd)
    ? Math.max(registrationEnd, meetingCountdownStart)
    : meetingCountdownStart;
  const gameEnd = new Date(event.gameEnd).getTime();

  if (Number.isFinite(gameEnd) && currentTime >= gameEnd) {
    return "concluded";
  }
  if (Number.isFinite(startingAt) && currentTime >= startingAt) {
    return "starting";
  }
  if (Number.isFinite(registrationEnd) && currentTime >= registrationEnd) {
    return "closed";
  }
  return "registration";
}

export function isTrainingRegistrationStillOpen(event: {
  kind?: EventKind;
  registrationEnd: string;
  status?: EventStatus;
}, now: Date = new Date()): boolean {
  if ((event.kind ?? "match") !== "training") {
    return false;
  }

  const registrationEnd = new Date(event.registrationEnd).getTime();
  return event.status === "starting" && Number.isFinite(registrationEnd) && now.getTime() < registrationEnd;
}

export function canAcceptSignups(event: {
  kind?: EventKind;
  registrationEnd: string;
  status?: EventStatus;
}, now: Date = new Date()): boolean {
  return event.status === "registration" || isTrainingRegistrationStillOpen(event, now);
}

export function resolveCreateForumChannel(event: {
  kind?: EventKind;
  createForumChannel?: boolean;
}): boolean {
  if (typeof event.createForumChannel === "boolean") {
    return event.createForumChannel;
  }

  return (event.kind ?? "match") === "match";
}

export function isEventCancelledBeforeMeeting(event: {
  concludedAt?: string;
  meetingStart: string;
}): boolean {
  const concludedAt = event.concludedAt ? new Date(event.concludedAt).getTime() : Number.NaN;
  const meetingStart = new Date(event.meetingStart).getTime();
  return Number.isFinite(concludedAt) && Number.isFinite(meetingStart) && concludedAt < meetingStart;
}

export function normalizeEventTimestamps<T extends EventLike>(event: T, nowIso: string) {
  return {
    statusUpdatedAt: event.statusUpdatedAt ?? event.updatedAt ?? event.createdAt ?? nowIso,
    updatedAt: event.updatedAt ?? event.createdAt ?? nowIso,
  };
}
