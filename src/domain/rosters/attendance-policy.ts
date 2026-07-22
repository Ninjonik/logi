import { normalizeOptionalArray } from "@/domain/shared/collections";

import type { AttendanceStatus, RosterLike } from "./types";

export function getAttendanceFields(status: AttendanceStatus) {
  if (status === "confirmed") {
    return { ack: true, confirmed: true };
  }

  if (status === "acknowledged") {
    return { ack: true, confirmed: false };
  }

  return { ack: false, confirmed: false };
}

export function setRosterAttendanceStatus<T extends RosterLike>(roster: T, userId: string, status: AttendanceStatus): T {
  let found = false;
  const nextAttendance = getAttendanceFields(status);
  const squads = roster.squads.map((squad) => ({
    ...squad,
    players: squad.players.map((player) => {
      if (player.id !== userId) {
        return player;
      }

      found = true;
      return {
        ...player,
        ...nextAttendance,
      };
    }),
  }));
  const reserveAttendances = normalizeOptionalArray(roster.reserveAttendances).map((entry) => {
    if (entry.userId !== userId) {
      return entry;
    }

    found = true;
    return {
      ...entry,
      ...nextAttendance,
    };
  });

  if (!found && roster.reservePlayerIds.includes(userId)) {
    found = true;
    reserveAttendances.push({
      userId,
      ...nextAttendance,
    });
  }

  if (!found) {
    throw new Error("User is not on the roster.");
  }

  return {
    ...roster,
    squads,
    reserveAttendances,
  };
}

export function acknowledgeRosterAttendance<T extends RosterLike>(roster: T, userId: string): T {
  return setRosterAttendanceStatus(roster, userId, "acknowledged");
}
