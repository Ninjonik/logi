import { fetchMutation } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getInternalAuthSecret } from "@/lib/env";
import { parsePlatformIdsInput } from "@/lib/platform-ids";

const upsertAssignmentReference = makeFunctionReference<"mutation">("userAssignments:upsert");
const importDiscordMembersReference = makeFunctionReference<"mutation">("userAssignments:importDiscordMembers");
const removeAssignmentReference = makeFunctionReference<"mutation">("userAssignments:remove");
const reassignImportedMemberReference = makeFunctionReference<"mutation">("userAssignments:reassignImportedMember");
const updatePlatformIdsReference = makeFunctionReference<"mutation">("players:updatePlatformIds");
const clearPlatformIdsReference = makeFunctionReference<"mutation">("players:clearPlatformIds");
const upsertImportedProfileReference = makeFunctionReference<"mutation">("players:upsertImportedProfile");
const linkImportedDiscordProfileReference = makeFunctionReference<"mutation">("players:linkImportedDiscordProfile");
const mergeUsersReference = makeFunctionReference<"mutation">("players:mergeUsers");

export async function saveServerUserAssignmentCommand(input: {
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

export async function deleteServerUserAssignmentCommand(assignmentId: string) {
  return await fetchMutation(removeAssignmentReference, {
    secret: getInternalAuthSecret(),
    assignmentId: assignmentId as never,
  });
}

export async function reassignImportedMemberCommand(input: {
  userId: string;
  targetServerId: string;
}) {
  return await fetchMutation(reassignImportedMemberReference, {
    secret: getInternalAuthSecret(),
    userId: input.userId,
    targetServerId: input.targetServerId as never,
  }) as {
    userId: string;
    targetServerDiscordId: string;
    reassigned: boolean;
  };
}

export async function importDiscordMembersForServerCommand(input: {
  serverId: string;
  assignmentType: "member" | "mercenary";
  members: Array<{
    userId: string;
    name: string;
    avatar: string;
    nickname?: string;
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

export async function savePlayerPlatformIdCommand(input: {
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

export async function upsertImportedPlayerCommand(input: {
  id: string;
  name: string;
  platformId: string;
}) {
  return await fetchMutation(upsertImportedProfileReference, {
    secret: getInternalAuthSecret(),
    id: input.id,
    name: input.name,
    platformId: input.platformId,
  }) as {
    userId: string;
    action: "created" | "updated";
  };
}

export async function linkImportedDiscordProfileCommand(input: {
  userId: string;
  discordId: string;
  name: string;
  avatar: string;
}) {
  return await fetchMutation(linkImportedDiscordProfileReference, {
    secret: getInternalAuthSecret(),
    userId: input.userId,
    discordId: input.discordId,
    name: input.name,
    avatar: input.avatar,
  }) as {
    userId: string;
    merged: boolean;
  };
}

export async function mergeUsersCommand(input: {
  primaryUserId: string;
  secondaryUserId: string;
}) {
  return await fetchMutation(mergeUsersReference, {
    secret: getInternalAuthSecret(),
    primaryUserId: input.primaryUserId,
    secondaryUserId: input.secondaryUserId,
  }) as {
    primaryUserId: string;
    secondaryUserId: string;
    affectedServerIds: string[];
    touchedEventIds: string[];
    touchedRosterIds: string[];
  };
}
