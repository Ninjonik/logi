import type { AppUser, Group, Roster } from "@/types/domain";
import type { ServerUserAssignment } from "@/lib/server-user-management";
import { getUserScoreForGuild } from "@/lib/user-scores";

type ParticipantStatus = "attending" | "not_attending";

type RosterPreferenceKey = "command" | "infantry" | "armor" | "recon" | "artillery" | "other";

type SlotContext = {
  squadGroup?: string;
  roleName?: string;
  roleIcon?: string;
};

type RosterSlot = SlotContext & {
  squadIndex: number;
  playerIndex: number;
};

type CandidateRankingContext = {
  usersById: Map<string, AppUser>;
  assignmentsByUserId: Map<string, ServerUserAssignment>;
  groupsById: Map<string, Group>;
  signupGroupByUserId: Map<string, string | null>;
  participantStatusByUserId: Map<string, ParticipantStatus>;
  serverDiscordId: string;
};

const SIGNUP_NOT_ATTENDING = "not_attending";

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function getRosterPreferenceKey(value?: string | null): RosterPreferenceKey {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "other";
  }

  if (normalized.includes("artillery")) {
    return "artillery";
  }

  if (normalized.includes("recon") || normalized.includes("sniper") || normalized.includes("spotter")) {
    return "recon";
  }

  if (
    normalized.includes("armor") ||
    normalized.includes("tank") ||
    normalized.includes("gunner") ||
    normalized.includes("driver") ||
    normalized.includes("crew")
  ) {
    return "armor";
  }

  if (
    normalized.includes("command") ||
    normalized.includes("commander") ||
    normalized.includes("officer")
  ) {
    return "command";
  }

  if (
    normalized.includes("infantry") ||
    normalized.includes("rifle") ||
    normalized.includes("assault") ||
    normalized.includes("support") ||
    normalized.includes("medic") ||
    normalized.includes("engineer") ||
    normalized.includes("anti-tank") ||
    normalized.includes("machine gun") ||
    normalized.includes("autorifle")
  ) {
    return "infantry";
  }

  return "other";
}

export function formatRosterPreferenceLabel(value?: string | null) {
  const normalized = normalizeText(value);
  if (!normalized || normalized === SIGNUP_NOT_ATTENDING) {
    return null;
  }

  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getSignupGroupByUserId(event?: {
  participants?: Array<{ userId: string; status: ParticipantStatus; group?: string | null }>;
  signUps?: Array<{ userId: string; group?: string | null }>;
}) {
  const result = new Map<string, string | null>();

  for (const participant of event?.participants ?? []) {
    if (participant.status === "not_attending") {
      result.set(participant.userId, SIGNUP_NOT_ATTENDING);
      continue;
    }

    result.set(participant.userId, participant.group ?? null);
  }

  for (const signUp of event?.signUps ?? []) {
    if (result.has(signUp.userId)) {
      continue;
    }

    result.set(signUp.userId, signUp.group ?? null);
  }

  return result;
}

export function getUserSignupLabel(userId: string, signupGroupByUserId: Map<string, string | null>) {
  return formatRosterPreferenceLabel(signupGroupByUserId.get(userId));
}

export function getSlotPreferenceKey(slot: SlotContext): RosterPreferenceKey {
  const rolePreference = getRosterPreferenceKey(slot.roleName ?? slot.roleIcon);
  if (rolePreference !== "other") {
    if (rolePreference === "command" && getRosterPreferenceKey(slot.squadGroup) === "infantry") {
      return "infantry";
    }

    return rolePreference;
  }

  return getRosterPreferenceKey(slot.squadGroup);
}

function getSignupMatchRank(userId: string, slot: SlotContext | undefined, signupGroupByUserId: Map<string, string | null>) {
  if (!slot) {
    return 1;
  }

  const signupPreference = getRosterPreferenceKey(signupGroupByUserId.get(userId));
  const slotPreference = getSlotPreferenceKey(slot);

  if (signupPreference === "other") {
    return 1;
  }

  return signupPreference === slotPreference ? 0 : 2;
}

function getGroupMatchRank(userId: string, squadGroup: string | undefined, assignmentsByUserId: Map<string, ServerUserAssignment>, groupsById: Map<string, Group>) {
  if (!squadGroup) {
    return 2;
  }

  const assignment = assignmentsByUserId.get(userId);
  if (!assignment) {
    return 2;
  }

  const primaryGroup = assignment.primaryGroupId ? groupsById.get(assignment.primaryGroupId)?.name : undefined;
  if (primaryGroup === squadGroup) {
    return 0;
  }

  const hasSecondaryMatch = assignment.secondaryGroupIds.some((groupId) => groupsById.get(groupId)?.name === squadGroup);
  if (hasSecondaryMatch) {
    return 1;
  }

  return 2;
}

function getAttendanceRank(userId: string, participantStatusByUserId: Map<string, ParticipantStatus>, signupGroupByUserId: Map<string, string | null>) {
  const participantStatus = participantStatusByUserId.get(userId);
  const signupGroup = signupGroupByUserId.get(userId);

  if (participantStatus === "not_attending" || signupGroup === SIGNUP_NOT_ATTENDING) {
    return 1;
  }

  return 0;
}

function getKd(user: AppUser) {
  return user.performance?.averages.killDeathRatio ?? -1;
}

function getScore(user: AppUser, serverDiscordId: string) {
  return getUserScoreForGuild(user, serverDiscordId);
}

function getStatBounds(
  userIds: string[],
  usersById: Map<string, AppUser>,
  getValue: (user: AppUser) => number,
) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const userId of userIds) {
    const user = usersById.get(userId);
    if (!user) {
      continue;
    }

    const value = getValue(user);
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 0 };
  }

  return { min, max };
}

function normalizeStat(value: number, bounds: { min: number; max: number }) {
  if (bounds.max === bounds.min) {
    return 0;
  }

  return (value - bounds.min) / (bounds.max - bounds.min);
}

function getPrimaryGroupRank(userId: string, squadGroup: string | undefined, assignmentsByUserId: Map<string, ServerUserAssignment>, groupsById: Map<string, Group>) {
  if (!squadGroup) {
    return 1;
  }

  const assignment = assignmentsByUserId.get(userId);
  if (!assignment?.primaryGroupId) {
    return 1;
  }

  return groupsById.get(assignment.primaryGroupId)?.name === squadGroup ? 0 : 1;
}

function getSecondaryGroupRank(userId: string, squadGroup: string | undefined, assignmentsByUserId: Map<string, ServerUserAssignment>, groupsById: Map<string, Group>) {
  if (!squadGroup) {
    return 1;
  }

  const assignment = assignmentsByUserId.get(userId);
  if (!assignment) {
    return 1;
  }

  return assignment.secondaryGroupIds.some((groupId) => groupsById.get(groupId)?.name === squadGroup) ? 0 : 1;
}

export function compareRosterCandidates(
  leftUserId: string,
  rightUserId: string,
  context: CandidateRankingContext,
  slot?: SlotContext,
  options?: {
    assignedElsewhereUserIds?: Set<string>;
  },
) {
  const leftUser = context.usersById.get(leftUserId);
  const rightUser = context.usersById.get(rightUserId);

  if (!leftUser || !rightUser) {
    return leftUser ? -1 : rightUser ? 1 : 0;
  }

  const assignedElsewhereUserIds = options?.assignedElsewhereUserIds;
  if (assignedElsewhereUserIds) {
    const leftAssignedElsewhere = assignedElsewhereUserIds.has(leftUserId) ? 1 : 0;
    const rightAssignedElsewhere = assignedElsewhereUserIds.has(rightUserId) ? 1 : 0;
    if (leftAssignedElsewhere !== rightAssignedElsewhere) {
      return leftAssignedElsewhere - rightAssignedElsewhere;
    }
  }

  const leftAttendanceRank = getAttendanceRank(leftUserId, context.participantStatusByUserId, context.signupGroupByUserId);
  const rightAttendanceRank = getAttendanceRank(rightUserId, context.participantStatusByUserId, context.signupGroupByUserId);
  if (leftAttendanceRank !== rightAttendanceRank) {
    return leftAttendanceRank - rightAttendanceRank;
  }

  const leftSignupRank = getSignupMatchRank(leftUserId, slot, context.signupGroupByUserId);
  const rightSignupRank = getSignupMatchRank(rightUserId, slot, context.signupGroupByUserId);
  if (leftSignupRank !== rightSignupRank) {
    return leftSignupRank - rightSignupRank;
  }

  const leftGroupRank = getGroupMatchRank(leftUserId, slot?.squadGroup, context.assignmentsByUserId, context.groupsById);
  const rightGroupRank = getGroupMatchRank(rightUserId, slot?.squadGroup, context.assignmentsByUserId, context.groupsById);
  if (leftGroupRank !== rightGroupRank) {
    return leftGroupRank - rightGroupRank;
  }

  const leftScore = getUserScoreForGuild(leftUser, context.serverDiscordId);
  const rightScore = getUserScoreForGuild(rightUser, context.serverDiscordId);
  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  const leftKd = getKd(leftUser);
  const rightKd = getKd(rightUser);
  if (leftKd !== rightKd) {
    return rightKd - leftKd;
  }

  return leftUser.name.localeCompare(rightUser.name);
}

export type AutoFillWeights = {
  score: number;
  kd: number;
};

function compareAutoFillPlayerPriority(
  leftUserId: string,
  rightUserId: string,
  context: CandidateRankingContext,
  weights: AutoFillWeights,
  userIds: string[],
) {
  const leftUser = context.usersById.get(leftUserId);
  const rightUser = context.usersById.get(rightUserId);

  if (!leftUser || !rightUser) {
    return leftUser ? -1 : rightUser ? 1 : 0;
  }

  const scoreBounds = getStatBounds(userIds, context.usersById, (user) => getScore(user, context.serverDiscordId));
  const kdBounds = getStatBounds(userIds, context.usersById, getKd);

  const leftWeightedValue =
    normalizeStat(getScore(leftUser, context.serverDiscordId), scoreBounds) * weights.score +
    normalizeStat(getKd(leftUser), kdBounds) * weights.kd;
  const rightWeightedValue =
    normalizeStat(getScore(rightUser, context.serverDiscordId), scoreBounds) * weights.score +
    normalizeStat(getKd(rightUser), kdBounds) * weights.kd;

  if (leftWeightedValue !== rightWeightedValue) {
    return rightWeightedValue - leftWeightedValue;
  }

  const leftScore = getScore(leftUser, context.serverDiscordId);
  const rightScore = getScore(rightUser, context.serverDiscordId);
  if (weights.score > 0 && leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  const leftKd = getKd(leftUser);
  const rightKd = getKd(rightUser);
  if (weights.kd > 0 && leftKd !== rightKd) {
    return rightKd - leftKd;
  }

  return compareRosterCandidates(leftUserId, rightUserId, context);
}

function compareSlotsForUser(
  userId: string,
  leftSlot: RosterSlot,
  rightSlot: RosterSlot,
  context: CandidateRankingContext,
) {
  const leftSignupRank = getSignupMatchRank(userId, leftSlot, context.signupGroupByUserId);
  const rightSignupRank = getSignupMatchRank(userId, rightSlot, context.signupGroupByUserId);
  if (leftSignupRank !== rightSignupRank) {
    return leftSignupRank - rightSignupRank;
  }

  const leftPrimaryRank = getPrimaryGroupRank(userId, leftSlot.squadGroup, context.assignmentsByUserId, context.groupsById);
  const rightPrimaryRank = getPrimaryGroupRank(userId, rightSlot.squadGroup, context.assignmentsByUserId, context.groupsById);
  if (leftPrimaryRank !== rightPrimaryRank) {
    return leftPrimaryRank - rightPrimaryRank;
  }

  const leftSecondaryRank = getSecondaryGroupRank(userId, leftSlot.squadGroup, context.assignmentsByUserId, context.groupsById);
  const rightSecondaryRank = getSecondaryGroupRank(userId, rightSlot.squadGroup, context.assignmentsByUserId, context.groupsById);
  if (leftSecondaryRank !== rightSecondaryRank) {
    return leftSecondaryRank - rightSecondaryRank;
  }

  if (leftSlot.squadIndex !== rightSlot.squadIndex) {
    return leftSlot.squadIndex - rightSlot.squadIndex;
  }

  return leftSlot.playerIndex - rightSlot.playerIndex;
}

export function autoFillRosterAssignments(
  board: Roster,
  context: CandidateRankingContext,
  weights: AutoFillWeights,
) {
  const next = structuredClone(board);
  const availableUserIds = Array.from(new Set(next.reservePlayerIds || []));
  const emptySlots: RosterSlot[] = [];

  next.squads.forEach((squad, squadIndex) => {
    squad.players.forEach((player, playerIndex) => {
      if (player.id || getCustomNameFromSlot(player.customName)) {
        return;
      }

      emptySlots.push({
        squadIndex,
        playerIndex,
        squadGroup: squad.group,
        roleName: player.roleName,
        roleIcon: player.roleIcon,
      });
    });
  });

  const sortedUsers = availableUserIds
    .slice()
    .sort((leftUserId, rightUserId) => compareAutoFillPlayerPriority(leftUserId, rightUserId, context, weights, availableUserIds));

  const unassignedUserIds: string[] = [];

  for (const userId of sortedUsers) {
    if (emptySlots.length === 0) {
      unassignedUserIds.push(userId);
      continue;
    }

    let bestSlotIndex = 0;

    for (let index = 1; index < emptySlots.length; index += 1) {
      if (compareSlotsForUser(userId, emptySlots[index], emptySlots[bestSlotIndex], context) < 0) {
        bestSlotIndex = index;
      }
    }

    const [slot] = emptySlots.splice(bestSlotIndex, 1);
    const player = next.squads[slot.squadIndex]?.players[slot.playerIndex];
    if (!player) {
      unassignedUserIds.push(userId);
      continue;
    }

    player.id = userId;
    player.customName = undefined;
    player.ack = false;
    player.confirmed = false;
  }

  next.reservePlayerIds = unassignedUserIds;
  return next;
}

function getCustomNameFromSlot(customName?: string) {
  return customName?.trim() || undefined;
}

export function getAssignedElsewhereUserIds(
  board: Roster,
  currentSlot: { squadIndex: number; playerIndex: number },
) {
  const result = new Set<string>();

  board.squads.forEach((squad, squadIndex) => {
    squad.players.forEach((player, playerIndex) => {
      if (!player.id) {
        return;
      }

      if (squadIndex === currentSlot.squadIndex && playerIndex === currentSlot.playerIndex) {
        return;
      }

      result.add(player.id);
    });
  });

  return result;
}
