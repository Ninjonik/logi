import type { EventStatus } from "./types";

const HISTORICAL_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function getAttendanceReminderDueAt(meetingStart: string, offsetHours: number, now: Date): string | null {
  const meetingStartMs = new Date(meetingStart).getTime();
  if (!Number.isFinite(meetingStartMs) || meetingStartMs <= now.getTime()) {
    return null;
  }

  const scheduledAtMs = meetingStartMs - offsetHours * 60 * 60 * 1000;
  if (scheduledAtMs > now.getTime()) {
    return new Date(scheduledAtMs).toISOString();
  }

  // A reschedule inside the 24-hour window must still notify the roster.
  // Later reminder windows are intentionally not backfilled all at once.
  return offsetHours === 24 ? now.toISOString() : null;
}

export function shouldDiscardScheduledJob(input: {
  eventStatus?: EventStatus;
  gameEnd: string;
  now: Date;
}): boolean {
  if (input.eventStatus === "concluded") {
    return true;
  }

  const gameEndMs = new Date(input.gameEnd).getTime();
  return Number.isFinite(gameEndMs) && gameEndMs < input.now.getTime() - HISTORICAL_EVENT_AGE_MS;
}

export function isExpiredScheduledJobClaim(claimedAt: string | undefined, now: Date): boolean {
  if (!claimedAt) {
    return true;
  }

  const claimedAtMs = new Date(claimedAt).getTime();
  return !Number.isFinite(claimedAtMs) || claimedAtMs < now.getTime() - 5 * 60 * 1000;
}
