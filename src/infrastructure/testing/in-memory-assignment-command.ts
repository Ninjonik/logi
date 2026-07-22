import type { AssignmentCommandRepository, AssignmentRecord, AssignmentRosterSyncPort } from "@/application/assignments/ports";

export class InMemoryAssignmentCommandRepository implements AssignmentCommandRepository {
  constructor(
    public readonly assignments: Map<string, AssignmentRecord>,
    public readonly servers: Set<string>,
    public readonly users: Set<string>,
    public readonly groupNamesByServer: Map<string, Map<string, string>>,
    public readonly openEventIdsByServer: Map<string, string[]>,
  public readonly serverMembershipPatches: Array<{ serverDiscordId: string; patch: any }> = [],
  public readonly userMembershipPatches: Array<{ userId: string; patch: any }> = [],
  public readonly importedUsers: Map<string, { name: string; avatar: string; createdAt: string; updatedAt: string }> = new Map(),
  ) {}

  async serverExists(serverDiscordId: string): Promise<boolean> {
    return this.servers.has(serverDiscordId);
  }

  async userExists(userId: string): Promise<boolean> {
    return this.users.has(userId);
  }

  async getById(assignmentId: string): Promise<AssignmentRecord | null> {
    return this.assignments.get(assignmentId) ?? null;
  }

  async getByServerUser(serverDiscordId: string, userId: string): Promise<AssignmentRecord | null> {
    return [...this.assignments.values()].find((item) => item.serverId === serverDiscordId && item.userId === userId) ?? null;
  }

  async listByServer(serverDiscordId: string): Promise<AssignmentRecord[]> {
    return [...this.assignments.values()].filter((item) => item.serverId === serverDiscordId);
  }

  async listByUser(userId: string): Promise<AssignmentRecord[]> {
    return [...this.assignments.values()].filter((item) => item.userId === userId);
  }

  async listGroupNamesByServer(serverDiscordId: string): Promise<Map<string, string>> {
    return this.groupNamesByServer.get(serverDiscordId) ?? new Map();
  }

  async save(input: {
    assignmentId?: string;
    userId: string;
    serverId: string;
    type: any;
    status: any;
    membershipCategoryId?: string;
    primaryGroupId?: string;
    secondaryGroupIds: string[];
    paused: boolean;
    pausedNote?: string;
    nowIso: string;
  }): Promise<string> {
    const id = input.assignmentId ?? `assignment-${this.assignments.size + 1}`;
    const existing = this.assignments.get(id);

    this.assignments.set(id, {
      id,
      userId: input.userId,
      serverId: input.serverId,
      type: input.type,
      status: input.status,
      membershipCategoryId: input.membershipCategoryId,
      primaryGroupId: input.primaryGroupId,
      secondaryGroupIds: input.secondaryGroupIds,
      paused: input.paused,
      pausedNote: input.pausedNote,
      createdAt: existing?.createdAt ?? input.nowIso,
      updatedAt: input.nowIso,
    });

    return id;
  }

  async remove(assignmentId: string): Promise<void> {
    this.assignments.delete(assignmentId);
  }

  async updateServerMembership(serverDiscordId: string, patch: any): Promise<void> {
    this.serverMembershipPatches.push({ serverDiscordId, patch });
  }

  async updateUserMembership(userId: string, patch: any): Promise<void> {
    this.userMembershipPatches.push({ userId, patch });
  }

  async listOpenMatchEventIds(serverDiscordId: string): Promise<string[]> {
    return this.openEventIdsByServer.get(serverDiscordId) ?? [];
  }

  async upsertImportedUser(input: {
    userId: string;
    name: string;
    avatar: string;
    nowIso: string;
  }): Promise<"created" | "updated"> {
    const existing = this.importedUsers.get(input.userId);
    const avatar = input.avatar || existing?.avatar || "https://cdn.discordapp.com/embed/avatars/0.png";

    if (existing) {
      this.importedUsers.set(input.userId, {
        ...existing,
        name: input.name,
        avatar,
        updatedAt: input.nowIso,
      });
      return "updated";
    }

    this.users.add(input.userId);
    this.importedUsers.set(input.userId, {
      name: input.name,
      avatar,
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
    });
    return "created";
  }
}

export class RecordingAssignmentRosterSyncPort implements AssignmentRosterSyncPort {
  public readonly eventIds: string[] = [];

  async syncEvent(eventId: string): Promise<void> {
    this.eventIds.push(eventId);
  }
}
