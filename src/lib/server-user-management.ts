import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getInternalAuthSecret } from "@/lib/env";
import type { AppUser, Guild } from "@/types/domain";

const listAssignmentsReference = makeFunctionReference<"query">("userAssignments:listForServer");
const getAssignmentByIdReference = makeFunctionReference<"query">("userAssignments:getById");
const getUsersByIdsReference = makeFunctionReference<"query">("serverData:getUsersByIds");
const listUsersReference = makeFunctionReference<"query">("serverData:listUsers");
const upsertAssignmentReference = makeFunctionReference<"mutation">("userAssignments:upsert");
const removeAssignmentReference = makeFunctionReference<"mutation">("userAssignments:remove");

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

export async function getServerUserAssignments(serverId: string): Promise<ServerUserAssignment[]> {
  return (await fetchQuery(listAssignmentsReference, { serverId })) as ServerUserAssignment[];
}

export async function getServerUserAssignment(assignmentId: string) {
  return (await fetchQuery(getAssignmentByIdReference, {
    assignmentId: assignmentId as never,
  })) as ServerUserAssignment | null;
}

export async function getUsersByIds(userIds: string[]) {
  return (await fetchQuery(getUsersByIdsReference, { userIds })) as AppUser[];
}

export async function listUsers() {
  return (await fetchQuery(listUsersReference, {})) as AppUser[];
}

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
    primaryGroupId: input.primaryGroupId as never,
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
