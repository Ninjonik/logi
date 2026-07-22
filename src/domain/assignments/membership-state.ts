import { getResolvedMemberStatus, type AssignmentStatus, type AssignmentType } from "./policy";

export type AssignmentMembershipRecord = {
  userId: string;
  serverId: string;
  type: AssignmentType;
  status: AssignmentStatus;
  primaryGroupId?: string;
  secondaryGroupIds?: string[];
  createdAt: string;
};

export function buildServerMembershipState(input: {
  assignments: AssignmentMembershipRecord[];
  groupNameById: Map<string, string>;
}): {
  memberIds: string[];
  members: Array<{
    id: string;
    primaryGroup?: string;
    secondaryGroups: string[];
    joinedAt: string;
    status: "pending" | "recruit" | "member" | "mercenary";
  }>;
  mercenaryIds: string[];
} {
  const activeMemberAssignments = input.assignments.filter((item) => item.type === "member" && item.status !== "pending");
  const activeMercAssignments = input.assignments.filter((item) => item.type === "mercenary" && item.status === "active");

  return {
    memberIds: activeMemberAssignments.map((item) => item.userId),
    members: activeMemberAssignments.map((item) => ({
      id: item.userId,
      primaryGroup: item.primaryGroupId ? input.groupNameById.get(String(item.primaryGroupId)) : undefined,
      secondaryGroups: (item.secondaryGroupIds ?? [])
        .map((groupId) => input.groupNameById.get(String(groupId)))
        .filter((groupName): groupName is string => Boolean(groupName)),
      joinedAt: item.createdAt,
      status: getResolvedMemberStatus(item.type, item.status),
    })),
    mercenaryIds: activeMercAssignments.map((item) => item.userId),
  };
}

export function buildUserMembershipState(input: {
  assignments: AssignmentMembershipRecord[];
}): {
  guildId?: string;
  mercenaryGuildIds: string[];
} {
  const primaryAssignment = input.assignments.find((item) => item.type === "member" && item.status !== "pending");
  const mercenaryGuildIds = input.assignments
    .filter((item) => item.type === "mercenary" && item.status === "active")
    .map((item) => item.serverId);

  return {
    guildId: primaryAssignment?.serverId,
    mercenaryGuildIds,
  };
}
