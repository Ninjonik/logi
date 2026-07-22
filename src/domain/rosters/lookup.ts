import type { ReserveAttendanceRecord, RosterLike } from "./types";

export function getReserveAttendance(
  roster: { reserveAttendances?: ReserveAttendanceRecord[] } | null,
  userId: string,
) {
  return (roster?.reserveAttendances ?? []).find((entry) => entry.userId === userId);
}

export function buildRosterLookup(roster: {
  squads: Array<{ players: Array<{ id?: string; ack: boolean; confirmed?: boolean }> }>;
  reservePlayerIds: string[];
  reserveAttendances?: ReserveAttendanceRecord[];
} | null) {
  const rosteredUserIds = new Set<string>();
  const confirmedRosteredUserIds = new Set<string>();
  const reserveUserIds = new Set<string>(roster?.reservePlayerIds ?? []);
  const confirmedReserveUserIds = new Set<string>();

  for (const squad of roster?.squads ?? []) {
    for (const player of squad.players) {
      if (!player.id) continue;
      rosteredUserIds.add(player.id);
      if (player.confirmed) {
        confirmedRosteredUserIds.add(player.id);
      }
    }
  }

  for (const attendance of roster?.reserveAttendances ?? []) {
    if (attendance.confirmed) {
      confirmedReserveUserIds.add(attendance.userId);
    }
  }

  return {
    rosteredUserIds,
    confirmedRosteredUserIds,
    reserveUserIds,
    confirmedReserveUserIds,
  };
}

export function getRosteredUserIds(roster: RosterLike) {
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
