import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

type ParticipantRecord = {
  userId: string;
  status: "attending" | "not_attending";
  group?: string | null;
  updatedAt: string;
};

type SignUpRecord = {
  userId: string;
  group?: string | null;
};

type EventRecord = {
  _id: Id<"events">;
  guildId: string;
  kind?: "match" | "training";
  registrationEnd: string;
  participants?: ParticipantRecord[];
  signUps?: SignUpRecord[];
};

type AssignmentRecord = {
  userId: string;
  serverId: string;
  createdAt: string;
};

type RosterPlayer = {
  id?: string;
  customName?: string;
  ack: boolean;
  confirmed?: boolean;
  note?: string;
  roleName?: string;
  roleIcon?: string;
};

type ReserveAttendanceRecord = {
  userId: string;
  ack: boolean;
  confirmed?: boolean;
};

type RosterRecord = {
  _id: Id<"rosters">;
  eventId: Id<"events">;
  squadPresetId?: Id<"squadPresets">;
  squads: Array<{
    name: string;
    group: string;
    order: number;
    color: string;
    icon?: string;
    players: RosterPlayer[];
  }>;
  reservePlayerIds: string[];
  reserveAttendances?: ReserveAttendanceRecord[];
  notAttendingPlayerIds: string[];
  streamerId?: string;
  published: boolean;
  updatedAt?: string;
};

function normalizeOptionalArray<T>(value: T[] | undefined) {
  return Array.isArray(value) ? value : [];
}

function normalizeParticipants(event: EventRecord) {
  if (Array.isArray(event.participants) && event.participants.length > 0) {
    return event.participants;
  }

  return normalizeOptionalArray(event.signUps).map((signUp) => ({
    userId: signUp.userId,
    status: signUp.group ? "attending" as const : "not_attending" as const,
    group: signUp.group ?? null,
    updatedAt: event.registrationEnd,
  }));
}

function getRosteredUserIds(roster: RosterRecord) {
  const userIds = new Set<string>();

  for (const squad of roster.squads) {
    for (const player of squad.players) {
      if (player.id) {
        userIds.add(player.id);
      }
    }
  }

  for (const userId of roster.reservePlayerIds) {
    userIds.add(userId);
  }

  for (const userId of roster.notAttendingPlayerIds) {
    userIds.add(userId);
  }

  return userIds;
}

function buildTrackedUserIds(event: EventRecord, assignments: AssignmentRecord[]) {
  const tracked = new Set<string>(normalizeParticipants(event).map((participant) => participant.userId));
  const registrationEndAt = new Date(event.registrationEnd).getTime();
  const cutoff = Number.isFinite(registrationEndAt)
    ? Math.min(Date.now(), registrationEndAt)
    : Date.now();

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

function buildParticipantStatusByUserId(event: EventRecord) {
  return new Map(normalizeParticipants(event).map((participant) => [participant.userId, participant.status]));
}

function clearPlayer(player: RosterPlayer) {
  player.id = undefined;
  player.customName = undefined;
  player.ack = false;
  player.confirmed = false;
}

function dedupePreservingOrder(values: string[]) {
  return Array.from(new Set(values));
}

function syncReserveAttendances(
  roster: RosterRecord,
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
  roster: RosterRecord,
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

export function mergeRosterWithEventState(
  roster: RosterRecord,
  event: EventRecord,
  assignments: AssignmentRecord[],
) {
  const next = structuredClone(roster);
  const trackedUserIds = buildTrackedUserIds(event, assignments);
  const participantStatusByUserId = buildParticipantStatusByUserId(event);

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

export async function syncRosterMembershipForUser(
  ctx: MutationCtx,
  eventId: Id<"events">,
  userId: string,
) {
  const [event, roster] = await Promise.all([
    ctx.db.get(eventId),
    ctx.db.query("rosters").withIndex("eventId", (q) => q.eq("eventId", eventId)).unique(),
  ]);

  if (!event || !roster || (event.kind ?? "match") !== "match") {
    return false;
  }

  const assignments = await ctx.db
    .query("userAssignments")
    .withIndex("serverId", (q) => q.eq("serverId", event.guildId))
    .collect();

  const trackedUserIds = buildTrackedUserIds(event, assignments);
  const participantStatusByUserId = buildParticipantStatusByUserId(event);
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

  await ctx.db.patch(roster._id, {
    squads: next.squads,
    reservePlayerIds: next.reservePlayerIds,
    reserveAttendances: next.reserveAttendances ?? [],
    notAttendingPlayerIds: next.notAttendingPlayerIds,
    updatedAt: new Date().toISOString(),
  });

  return true;
}

export async function syncRosterMembershipForEvent(
  ctx: MutationCtx,
  eventId: Id<"events">,
) {
  const [event, roster] = await Promise.all([
    ctx.db.get(eventId),
    ctx.db.query("rosters").withIndex("eventId", (q) => q.eq("eventId", eventId)).unique(),
  ]);

  if (!event || !roster || (event.kind ?? "match") !== "match") {
    return false;
  }

  const assignments = await ctx.db
    .query("userAssignments")
    .withIndex("serverId", (q) => q.eq("serverId", event.guildId))
    .collect();

  const next = mergeRosterWithEventState(roster, event, assignments);

  await ctx.db.patch(roster._id, {
    squads: next.squads,
    reservePlayerIds: next.reservePlayerIds,
    reserveAttendances: next.reserveAttendances ?? [],
    notAttendingPlayerIds: next.notAttendingPlayerIds,
    updatedAt: new Date().toISOString(),
  });

  return true;
}
