import { cache } from "react";

import type { AppUser, Guild } from "@/types/domain";
import {
  deleteServerUserAssignmentCommand,
  importDiscordMembersForServerCommand,
  savePlayerPlatformIdCommand,
  saveServerUserAssignmentCommand,
} from "@/lib/gateways/assignment-commands";
import {
  getServerUserAssignmentReadModel,
  getServerUserAssignmentsReadModel,
  type ServerUserAssignmentReadModel,
} from "@/lib/read-models/assignments";
import { getUsersReadModelByIds, listUsersReadModel } from "@/lib/read-models/users";

export type ServerUserAssignment = ServerUserAssignmentReadModel;

export const getServerUserAssignments = cache(async function getServerUserAssignments(serverId: string): Promise<ServerUserAssignment[]> {
  return await getServerUserAssignmentsReadModel(serverId);
});

export const getServerUserAssignment = cache(async function getServerUserAssignment(assignmentId: string) {
  return await getServerUserAssignmentReadModel(assignmentId);
});

export async function getUsersByIds(userIds: string[]) {
  return await getUsersReadModelByIds(userIds);
}

export const listUsers = cache(async function listUsers() {
  return await listUsersReadModel();
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
  return await saveServerUserAssignmentCommand(input);
}

export async function deleteServerUserAssignment(assignmentId: string) {
  return await deleteServerUserAssignmentCommand(assignmentId);
}

export async function savePlayerPlatformId(input: {
  userId: string;
  platformIds?: string | string[];
}) {
  return await savePlayerPlatformIdCommand(input);
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
  return await importDiscordMembersForServerCommand(input) as {
    importedCount: number;
    createdUsers: number;
    updatedUsers: number;
    createdAssignments: number;
    updatedAssignments: number;
  };
}
