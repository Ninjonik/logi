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
