import type { AppUser, Roster } from "@/types/domain";

type SlotAssignment = {
  userId: string;
  squadName: string;
  roleName?: string;
};

export type RosterUpdateSummary = {
  hasChanges: boolean;
  addedUserIds: string[];
  removedUserIds: string[];
  movedUserIds: string[];
  roleChangedUserIds: string[];
  addedLines: string[];
  removedLines: string[];
  movedLines: string[];
  roleChangedLines: string[];
};

function getUserLabel(userId: string, usersById: Map<string, AppUser>) {
  return usersById.get(userId)?.name ?? userId;
}

function buildAssignedSlotMap(roster: Roster) {
  const assignments = new Map<string, SlotAssignment>();

  for (const squad of roster.squads) {
    for (const player of squad.players) {
      if (!player.id) continue;

      assignments.set(player.id, {
        userId: player.id,
        squadName: squad.name,
        roleName: player.roleName?.trim() || undefined,
      });
    }
  }

  return assignments;
}

export function summarizeRosterUpdates(before: Roster, after: Roster, users: AppUser[]): RosterUpdateSummary {
  const usersById = new Map(users.map((user) => [user.discordId, user]));
  const beforeAssignments = buildAssignedSlotMap(before);
  const afterAssignments = buildAssignedSlotMap(after);

  const addedUserIds: string[] = [];
  const removedUserIds: string[] = [];
  const movedUserIds: string[] = [];
  const roleChangedUserIds: string[] = [];
  const addedLines: string[] = [];
  const removedLines: string[] = [];
  const movedLines: string[] = [];
  const roleChangedLines: string[] = [];

  for (const [userId, nextAssignment] of afterAssignments) {
    const previousAssignment = beforeAssignments.get(userId);
    const userLabel = getUserLabel(userId, usersById);

    if (!previousAssignment) {
      addedUserIds.push(userId);
      addedLines.push(`🟢 ${userLabel} -> ${nextAssignment.squadName}${nextAssignment.roleName ? ` (${nextAssignment.roleName})` : ""}`);
      continue;
    }

    if (previousAssignment.squadName !== nextAssignment.squadName) {
      movedUserIds.push(userId);
      movedLines.push(`🔁 ${userLabel}: ${previousAssignment.squadName} -> ${nextAssignment.squadName}`);
    }

    if ((previousAssignment.roleName ?? "") !== (nextAssignment.roleName ?? "")) {
      roleChangedUserIds.push(userId);
      roleChangedLines.push(
        `🎯 ${userLabel}: ${(previousAssignment.roleName ?? "Open role")} -> ${(nextAssignment.roleName ?? "Open role")}`,
      );
    }
  }

  for (const [userId, previousAssignment] of beforeAssignments) {
    if (afterAssignments.has(userId)) continue;

    const userLabel = getUserLabel(userId, usersById);
    removedUserIds.push(userId);
    removedLines.push(`🔴 ${userLabel} <- ${previousAssignment.squadName}${previousAssignment.roleName ? ` (${previousAssignment.roleName})` : ""}`);
  }

  return {
    hasChanges: addedUserIds.length > 0 || removedUserIds.length > 0 || movedUserIds.length > 0 || roleChangedUserIds.length > 0,
    addedUserIds,
    removedUserIds,
    movedUserIds,
    roleChangedUserIds,
    addedLines,
    removedLines,
    movedLines,
    roleChangedLines,
  };
}
