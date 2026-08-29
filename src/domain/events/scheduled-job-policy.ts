import type { EventStatus } from "./types";

const HISTORICAL_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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
