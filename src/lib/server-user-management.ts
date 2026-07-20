import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { cache } from "react";

import { appCacheTags, tagCacheEntries } from "@/lib/cache-tags";
import { getInternalAuthSecret } from "@/lib/env";
import { parsePlatformIdsInput } from "@/lib/platform-ids";
import type { AppUser, Guild } from "@/types/domain";

const listAssignmentsReference = makeFunctionReference<"query">("userAssignments:listForServer");
const getAssignmentByIdReference = makeFunctionReference<"query">("userAssignments:getById");
const getUsersByIdsReference = makeFunctionReference<"query">("serverData:getUsersByIds");
const listUsersReference = makeFunctionReference<"query">("serverData:listUsers");
const upsertAssignmentReference = makeFunctionReference<"mutation">("userAssignments:upsert");
const importDiscordMembersReference = makeFunctionReference<"mutation">("userAssignments:importDiscordMembers");
const removeAssignmentReference = makeFunctionReference<"mutation">("userAssignments:remove");
const updatePlayerScoreReference = makeFunctionReference<"mutation">("players:updateScore");
const updatePlatformIdsReference = makeFunctionReference<"mutation">("players:updatePlatformIds");
const clearPlatformIdsReference = makeFunctionReference<"mutation">("players:clearPlatformIds");

export type ServerUserAssignment = {
  id: string;
  userId: string;
  serverId: string;
  type: "member" | "mercenary";
  status: "pending" | "recruit" | "active";
  membershipCategoryId?: string;
  primaryGroupId?: string;
  secondaryGroupIds: string[];
  paused: boolean;
  pausedNote?: string;
  createdAt: string;
  updatedAt: string;
};

export const getServerUserAssignments = cache(async function getServerUserAssignments(serverId: string): Promise<ServerUserAssignment[]> {
  "use cache";
  tagCacheEntries([appCacheTags.assignments(serverId)]);
  return (await fetchQuery(listAssignmentsReference, { serverId })) as ServerUserAssignment[];
});

export const getServerUserAssignment = cache(async function getServerUserAssignment(assignmentId: string) {
  "use cache";
  tagCacheEntries([appCacheTags.assignment(assignmentId)]);
  return (await fetchQuery(getAssignmentByIdReference, {
    assignmentId: assignmentId as never,
  })) as ServerUserAssignment | null;
});

export async function getUsersByIds(userIds: string[]) {
  "use cache";
  tagCacheEntries([
    appCacheTags.users(),
    ...userIds.map((userId) => appCacheTags.player(userId)),
  ]);
  return (await fetchQuery(getUsersByIdsReference, { userIds })) as AppUser[];
}

export const listUsers = cache(async function listUsers() {
  "use cache";
  tagCacheEntries([appCacheTags.users()]);
  return (await fetchQuery(listUsersReference, {})) as AppUser[];
});

export async function getAssignmentUser(assignment: ServerUserAssignment) {
  const users = await getUsersByIds([assignment.userId]);
  return users[0];
}

export async function getEligibleUsersForServer(server: Guild, assignments: ServerUserAssignment[]) {
  const currentUsers = await listUsers();

  return currentUsers.map((user) => {
    const existingHere = assignments.find((assignment) => assignment.userId === user.discordId);
    const canJoinAsMember = (!user.guildId || user.guildId === server.discordId) && existingHere?.type !== "mercenary";
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
  status: "pending" | "recruit" | "active";
  membershipCategoryId?: string;
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
    status: input.status,
    membershipCategoryId: input.membershipCategoryId,
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
  platformIds?: string | string[];
}) {
  const normalizedPlatformIds = parsePlatformIdsInput(input.platformIds);

  if (normalizedPlatformIds.length === 0) {
    return await fetchMutation(clearPlatformIdsReference, {
      secret: getInternalAuthSecret(),
      userId: input.userId,
    });
  }

  return await fetchMutation(updatePlatformIdsReference, {
    secret: getInternalAuthSecret(),
    userId: input.userId,
    platformIds: normalizedPlatformIds,
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
