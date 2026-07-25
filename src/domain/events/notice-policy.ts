import type { EventNotice, EventParticipant, EventStatus } from "./types";

export function findEligibleNoticeTargets(input: {
  events: Array<{
    id: string;
    name: string;
    gameStart: string;
    status: EventStatus;
    participants: EventParticipant[];
  }>;
  userId: string;
  query: string;
  now: Date;
}) {
  const normalizedQuery = input.query.trim().toLowerCase();
  const nowValue = input.now.getTime();

  return input.events
    .filter((event) => {
      const gameStart = new Date(event.gameStart).getTime();
      const isEligibleTime = Number.isFinite(gameStart) && nowValue < gameStart;
      const participant = event.participants.find((entry) => entry.userId === input.userId);

      if (!isEligibleTime || event.status === "concluded" || participant?.status !== "attending") {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return event.name.toLowerCase().includes(normalizedQuery) || event.id.toLowerCase().includes(normalizedQuery);
    })
    .slice(0, 25);
}

export function upsertNotice(input: {
  event: {
    gameStart: string;
    status: EventStatus;
    participants: EventParticipant[];
    absenceNotices: EventNotice[];
  };
  userId: string;
  reason: string;
  now: Date;
}) {
  const nowValue = input.now.getTime();
  const gameStart = new Date(input.event.gameStart).getTime();

  if (!Number.isFinite(gameStart) || nowValue >= gameStart) {
    throw new Error("Notice can only be submitted before game start.");
  }

  if (input.event.status === "concluded") {
    throw new Error("This event is already concluded.");
  }

  const participant = input.event.participants.find((entry) => entry.userId === input.userId);
  if (!participant || participant.status !== "attending") {
    throw new Error("Only attending players can submit a notice.");
  }

  const notices = input.event.absenceNotices.filter((entry) => entry.userId !== input.userId);
  notices.push({
    userId: input.userId,
    reason: input.reason.trim(),
    createdAt: input.now.toISOString(),
  });

  return notices;
}
