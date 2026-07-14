import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { cache } from "react";

import { getInternalAuthSecret } from "@/lib/env";
import type { AppUser, Guild } from "@/types/domain";

const listAssignmentsReference = makeFunctionReference<"query">("userAssignments:listForServer");
const getAssignmentByIdReference = makeFunctionReference<"query">("userAssignments:getById");
const getUsersByIdsReference = makeFunctionReference<"query">("serverData:getUsersByIds");
const listUsersReference = makeFunctionReference<"query">("serverData:listUsers");
const upsertAssignmentReference = makeFunctionReference<"mutation">("userAssignments:upsert");
const importDiscordMembersReference = makeFunctionReference<"mutation">("userAssignments:importDiscordMembers");
const removeAssignmentReference = makeFunctionReference<"mutation">("userAssignments:remove");
const updatePlayerScoreReference = makeFunctionReference<"mutation">("players:updateScore");
const updatePlatformIdReference = makeFunctionReference<"mutation">("players:updatePlatformId");
const clearPlatformIdReference = makeFunctionReference<"mutation">("players:clearPlatformId");

export type ServerUserAssignment = {
  id: string;
  userId: string;
  serverId: string;
  type: "member" | "mercenary";
  primaryGroupId?: string;
  secondaryGroupIds: string[];
  paused: boolean;
  pausedNote?: string;
  createdAt: string;
  updatedAt: string;
};

export const getServerUserAssignments = cache(async function getServerUserAssignments(serverId: string): Promise<ServerUserAssignment[]> {
  return (await fetchQuery(listAssignmentsReference, { serverId })) as ServerUserAssignment[];
});

export const getServerUserAssignment = cache(async function getServerUserAssignment(assignmentId: string) {
  return (await fetchQuery(getAssignmentByIdReference, {
    assignmentId: assignmentId as never,
  })) as ServerUserAssignment | null;
});

export async function getUsersByIds(userIds: string[]) {
  return (await fetchQuery(getUsersByIdsReference, { userIds })) as AppUser[];
}

export const listUsers = cache(async function listUsers() {
  return (await fetchQuery(listUsersReference, {})) as AppUser[];
});

export async function getAssignmentUser(assignment: ServerUserAssignment) {
  const users = await getUsersByIds([assignment.userId]);
  return users[0];
}

export async function getEligibleUsersForServer(server: Guild, assignments: ServerUserAssignment[]) {
  const currentUsers = await listUsers();

  return currentUsers.map((user) => {
    const existingHere = assignments.find((assignment) => assignment.userId === user.id);
    const canJoinAsMember = (!user.guildId || user.guildId === server.id) && existingHere?.type !== "mercenary";
    const canJoinAsMercenary = existingHere?.type !== "member";

    return {
      user,
      existingHere,
      canJoinAsMember,
      canJoinAsMercenary,
    };
  });
}

export async function saveServerUserAssignment(input: {
  assignmentId?: string;
  userId: string;
  serverId: string;
  type: "member" | "mercenary";
  primaryGroupId?: string;
  secondaryGroupIds: string[];
  paused: boolean;
  pausedNote?: string;
}) {
  return await fetchMutation(upsertAssignmentReference, {
    secret: getInternalAuthSecret(),
    assignmentId: input.assignmentId as never,
    userId: input.userId,
    serverId: input.serverId,
    type: input.type,
    primaryGroupId: (input.primaryGroupId || undefined) as never,
    secondaryGroupIds: input.secondaryGroupIds as never,
    paused: input.paused,
    pausedNote: input.pausedNote,
  });
}

export async function deleteServerUserAssignment(assignmentId: string) {
  return await fetchMutation(removeAssignmentReference, {
    secret: getInternalAuthSecret(),
    assignmentId: assignmentId as never,
  });
}

export async function savePlayerScore(input: {
  userId: string;
  score: number;
}) {
  return await fetchMutation(updatePlayerScoreReference, {
    secret: getInternalAuthSecret(),
    userId: input.userId,
    score: input.score,
  });
}

export async function savePlayerPlatformId(input: {
  userId: string;
  platformId?: string;
}) {
  const normalizedPlatformId = input.platformId?.replace(/\s+/g, "").trim();

  if (!normalizedPlatformId) {
    return await fetchMutation(clearPlatformIdReference, {
      secret: getInternalAuthSecret(),
      userId: input.userId,
    });
  }

  return await fetchMutation(updatePlatformIdReference, {
    secret: getInternalAuthSecret(),
    userId: input.userId,
    platformId: normalizedPlatformId,
  });
}

export async function importDiscordMembersForServer(input: {
  serverId: string;
  assignmentType: "member" | "mercenary";
  members: Array<{
    userId: string;
    name: string;
    avatar: string;
    secondaryGroupIds: string[];
  }>;
}) {
  return await fetchMutation(importDiscordMembersReference, {
    secret: getInternalAuthSecret(),
    serverId: input.serverId,
    assignmentType: input.assignmentType,
    members: input.members.map((member) => ({
      ...member,
      secondaryGroupIds: member.secondaryGroupIds as never,
    })) as never,
  }) as {
    importedCount: number;
    createdUsers: number;
    updatedUsers: number;
    createdAssignments: number;
    updatedAssignments: number;
  };
}
