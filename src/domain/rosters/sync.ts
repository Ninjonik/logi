import { dedupePreservingOrder, normalizeOptionalArray } from "@/domain/shared/collections";
import { normalizeParticipants } from "@/domain/events/participants";
import type { EventParticipant, EventSignup } from "@/domain/events/types";

import { getRosteredUserIds } from "./lookup";
import type { ReserveAttendanceRecord, RosterLike, RosterPlayer } from "./types";

type AssignmentRecord = {
  userId: string;
  serverId: string;
  createdAt: string;
};

type EventRecord = {
  guildId: string;
  registrationEnd: string;
  participants?: EventParticipant[];
  signUps?: EventSignup[];
  updatedAt?: string;
  createdAt?: string;
};

function clearPlayer(player: RosterPlayer) {
  player.id = undefined;
  player.customName = undefined;
  player.ack = false;
  player.confirmed = false;
}

function syncReserveAttendances(
  roster: RosterLike,
  reservePlayerIds: string[],
  previousAttendances: ReserveAttendanceRecord[],
  ensureUserId?: string,
) {
  const reserveUserIdSet = new Set(reservePlayerIds);
  const nextAttendances = previousAttendances.filter((entry) => reserveUserIdSet.has(entry.userId));

  if (ensureUserId && reserveUserIdSet.has(ensureUserId) && !nextAttendances.some((entry) => entry.userId === ensureUserId)) {
    nextAttendances.push({
      userId: ensureUserId,
      ack: false,
      confirmed: false,
    });
  }

  for (const userId of reservePlayerIds) {
    if (!nextAttendances.some((entry) => entry.userId === userId)) {
      nextAttendances.push({
        userId,
        ack: false,
        confirmed: false,
      });
    }
  }

  roster.reserveAttendances = nextAttendances;
}

function moveUserToBucket(
  roster: RosterLike,
  userId: string,
  bucket: "reserve" | "not_attending" | null,
) {
  for (const squad of roster.squads) {
    for (const player of squad.players) {
      if (player.id === userId) {
        clearPlayer(player);
      }
    }
  }

  roster.reservePlayerIds = roster.reservePlayerIds.filter((id) => id !== userId);
  roster.notAttendingPlayerIds = roster.notAttendingPlayerIds.filter((id) => id !== userId);

  if (bucket === "reserve") {
    roster.reservePlayerIds = dedupePreservingOrder([...roster.reservePlayerIds, userId]);
  }

  if (bucket === "not_attending") {
    roster.notAttendingPlayerIds = dedupePreservingOrder([...roster.notAttendingPlayerIds, userId]);
  }

  syncReserveAttendances(
    roster,
    roster.reservePlayerIds,
    normalizeOptionalArray(roster.reserveAttendances),
    bucket === "reserve" ? userId : undefined,
  );
}

function buildTrackedUserIds(event: EventRecord, assignments: AssignmentRecord[], now: Date) {
  const participantNow = event.updatedAt ?? event.createdAt ?? now.toISOString();
  const tracked = new Set<string>(normalizeParticipants(event.participants, event.signUps, participantNow).map((participant) => participant.userId));
  const registrationEndAt = new Date(event.registrationEnd).getTime();
  const cutoff = Number.isFinite(registrationEndAt)
    ? Math.min(now.getTime(), registrationEndAt)
    : now.getTime();

  for (const assignment of assignments) {
    if (assignment.serverId !== event.guildId) continue;

    const createdAt = new Date(assignment.createdAt).getTime();
    if (Number.isFinite(createdAt) && createdAt > cutoff) {
      continue;
    }

    tracked.add(assignment.userId);
  }

  return tracked;
}

function buildParticipantStatusByUserId(event: EventRecord, now: Date) {
  const participantNow = event.updatedAt ?? event.createdAt ?? now.toISOString();
  return new Map(
    normalizeParticipants(event.participants, event.signUps, participantNow).map((participant) => [participant.userId, participant.status]),
  );
}

export function mergeRosterWithEventState<T extends RosterLike>(
  roster: T,
  event: EventRecord,
  assignments: AssignmentRecord[],
  now: Date = new Date(),
) {
  const next = structuredClone(roster);
  const trackedUserIds = buildTrackedUserIds(event, assignments, now);
  const participantStatusByUserId = buildParticipantStatusByUserId(event, now);

  for (const userId of getRosteredUserIds(next)) {
    if (!trackedUserIds.has(userId)) {
      moveUserToBucket(next, userId, null);
    }
  }

  const placedUserIds = getRosteredUserIds(next);
  for (const userId of trackedUserIds) {
    if (placedUserIds.has(userId)) {
      continue;
    }

    moveUserToBucket(
      next,
      userId,
      participantStatusByUserId.get(userId) === "attending" ? "reserve" : "not_attending",
    );
  }

  return next;
}

export function syncRosterMembershipForUser<T extends RosterLike>(
  roster: T,
  event: EventRecord,
  assignments: AssignmentRecord[],
  userId: string,
  now: Date = new Date(),
) {
  const trackedUserIds = buildTrackedUserIds(event, assignments, now);
  const participantStatusByUserId = buildParticipantStatusByUserId(event, now);
  const next = structuredClone(roster);

  moveUserToBucket(
    next,
    userId,
    participantStatusByUserId.get(userId) === "attending"
      ? "reserve"
      : trackedUserIds.has(userId)
        ? "not_attending"
        : null,
  );

  return next;
}
