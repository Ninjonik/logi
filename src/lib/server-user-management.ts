import type { AppUser, Guild } from "@/types/domain";
import {
  deleteServerUserAssignmentCommand,
  importDiscordMembersForServerCommand,
  linkImportedDiscordProfileCommand,
  mergeUsersCommand,
  reassignImportedMemberCommand,
  savePlayerNoteCommand,
  savePlayerPlatformIdCommand,
  saveServerUserAssignmentCommand,
  upsertImportedPlayerCommand,
} from "@/lib/gateways/assignment-commands";
import {
  getServerUserAssignmentReadModel,
  getServerUserAssignmentsReadModel,
  type ServerUserAssignmentReadModel,
} from "@/lib/read-models/assignments";
import { getUsersReadModelByIds, listUsersReadModel, listUsersReadModelUncached } from "@/lib/read-models/users";

export type ServerUserAssignment = ServerUserAssignmentReadModel;

export async function getServerUserAssignments(serverId: string): Promise<ServerUserAssignment[]> {
  return await getServerUserAssignmentsReadModel(serverId);
}

export async function getServerUserAssignment(assignmentId: string) {
  return await getServerUserAssignmentReadModel(assignmentId);
}

export async function getUsersByIds(userIds: string[], guildId?: string) {
  return await getUsersReadModelByIds(userIds, guildId);
}

export async function listUsers(guildId?: string) {
  return await listUsersReadModel(guildId);
}

export async function listUsersUncached(guildId?: string) {
  return await listUsersReadModelUncached(guildId);
}

export async function getAssignmentUser(assignment: ServerUserAssignment) {
  const users = await getUsersByIds([assignment.userId]);
  return users[0];
}

export async function getEligibleUsersForServer(server: Guild, assignments: ServerUserAssignment[]) {
  const currentUsers = await listUsers(server.discordId);

  return currentUsers.map((user) => {
    const existingHere = assignments.find((assignment) => assignment.userId === user.discordId);
    const canJoinAsMember = (!user.guildId || user.guildId === server.discordId) && existingHere?.type !== "mercenary";
    const canJoinAsMercenary = existingHere?.type !== "member" && existingHere?.type !== "reserve_member";

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
  type: "member" | "reserve_member" | "mercenary";
  status: "pending" | "recruit" | "active";
  membershipCategoryId?: string;
  primaryGroupId?: string;
  secondaryGroupIds: string[];
  paused: boolean;
  pausedNote?: string;
  note?: string;
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

export async function savePlayerNote(input: {
  userId: string;
  note?: string;
}) {
  return await savePlayerNoteCommand(input);
}

export async function upsertImportedPlayer(input: {
  id: string;
  name: string;
  platformId: string;
}) {
  return await upsertImportedPlayerCommand(input);
}

export async function saveImportedClanMember(input: {
  userId: string;
  serverId: string;
}) {
  return await saveServerUserAssignmentCommand({
    userId: input.userId,
    serverId: input.serverId,
    type: "member",
    status: "active",
    secondaryGroupIds: [],
    paused: false,
  });
}

export async function reassignImportedMember(input: {
  userId: string;
  targetServerId: string;
}) {
  return await reassignImportedMemberCommand(input);
}

export async function linkImportedDiscordProfile(input: {
  userId: string;
  discordId: string;
  name: string;
  avatar: string;
}) {
  return await linkImportedDiscordProfileCommand(input);
}

export async function importDiscordMembersForServer(input: {
  serverId: string;
  assignmentType: "member" | "reserve_member" | "mercenary";
  members: Array<{
    userId: string;
    name: string;
    avatar: string;
    nickname?: string;
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

export async function mergeManagedUsers(input: {
  primaryUserId: string;
  secondaryUserId: string;
}) {
  return await mergeUsersCommand(input);
}
