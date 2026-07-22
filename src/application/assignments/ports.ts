import type { AssignmentStatus, AssignmentType } from "@/domain/assignments/policy";

export type AssignmentRecord = {
  id: string;
  userId: string;
  serverId: string;
  type: AssignmentType;
  status: AssignmentStatus;
  membershipCategoryId?: string;
  primaryGroupId?: string;
  secondaryGroupIds: string[];
  paused: boolean;
  pausedNote?: string;
  createdAt: string;
  updatedAt: string;
};

export interface AssignmentCommandRepository {
  serverExists(serverDiscordId: string): Promise<boolean>;
  userExists(userId: string): Promise<boolean>;
  getById(assignmentId: string): Promise<AssignmentRecord | null>;
  getByServerUser(serverDiscordId: string, userId: string): Promise<AssignmentRecord | null>;
  listByServer(serverDiscordId: string): Promise<AssignmentRecord[]>;
  listByUser(userId: string): Promise<AssignmentRecord[]>;
  listGroupNamesByServer(serverDiscordId: string): Promise<Map<string, string>>;
  save(input: {
    assignmentId?: string;
    userId: string;
    serverId: string;
    type: AssignmentType;
    status: AssignmentStatus;
    membershipCategoryId?: string;
    primaryGroupId?: string;
    secondaryGroupIds: string[];
    paused: boolean;
    pausedNote?: string;
    nowIso: string;
  }): Promise<string>;
  remove(assignmentId: string): Promise<void>;
  updateServerMembership(serverDiscordId: string, patch: {
    memberIds: string[];
    members: Array<{
      id: string;
      primaryGroup?: string;
      secondaryGroups: string[];
      joinedAt: string;
      status: "pending" | "recruit" | "member" | "mercenary";
    }>;
    mercenaryIds: string[];
    updatedAt: string;
  }): Promise<void>;
  updateUserMembership(userId: string, patch: {
    guildId?: string;
    mercenaryGuildIds: string[];
    updatedAt: string;
  }): Promise<void>;
  listOpenMatchEventIds(serverDiscordId: string, now: Date): Promise<string[]>;
  upsertImportedUser(input: {
    userId: string;
    name: string;
    avatar: string;
    nowIso: string;
  }): Promise<"created" | "updated">;
}

export interface AssignmentRosterSyncPort {
  syncEvent(eventId: string): Promise<void>;
}
