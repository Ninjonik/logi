export type RosterScoreSettings = {
  noCategory: number;
  declined: number;
  rosterPresent: number;
  reservePresent: number;
  rosterAbsent: number;
  reserveAbsent: number;
  excusedAbsence: number;
};

export type ScorableParticipant = {
  userId: string;
  status: "attending" | "not_attending";
};

export type ScorableNotice = {
  userId: string;
};

export type ScorableRoster = {
  squads: Array<{
    players: Array<{
      id?: string;
      confirmed?: boolean;
    }>;
  }>;
  reservePlayerIds: string[];
  reserveAttendances?: Array<{
    userId: string;
    confirmed?: boolean;
  }>;
};

function buildRosterLookup(roster: ScorableRoster | null) {
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

export function resolveRosterScoreDelta(input: {
  userId: string;
  settings: RosterScoreSettings;
  participants: ScorableParticipant[];
  notices: ScorableNotice[];
  roster: ScorableRoster | null;
}) {
  const participantByUserId = new Map(input.participants.map((participant) => [participant.userId, participant]));
  const noticesByUserId = new Set(input.notices.map((notice) => notice.userId));
  const rosterLookup = buildRosterLookup(input.roster);
  const participant = participantByUserId.get(input.userId);

  if (participant?.status === "not_attending") {
    return input.settings.declined;
  }

  if (participant?.status !== "attending") {
    return input.settings.noCategory;
  }

  const hasNotice = noticesByUserId.has(input.userId);
  const isRostered = rosterLookup.rosteredUserIds.has(input.userId);
  const isReserve = rosterLookup.reserveUserIds.has(input.userId) || !isRostered;
  const isConfirmedRoster = rosterLookup.confirmedRosteredUserIds.has(input.userId);
  const isConfirmedReserve = rosterLookup.confirmedReserveUserIds.has(input.userId);

  if (isConfirmedRoster) {
    return input.settings.rosterPresent;
  }
  if (isConfirmedReserve) {
    return input.settings.reservePresent;
  }
  if (hasNotice) {
    return input.settings.excusedAbsence;
  }
  if (isRostered) {
    return input.settings.rosterAbsent;
  }
  if (isReserve) {
    return input.settings.reserveAbsent;
  }

  return input.settings.noCategory;
}
