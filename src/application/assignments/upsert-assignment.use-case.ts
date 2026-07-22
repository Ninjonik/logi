import { validateAssignmentGroupIds } from "@/domain/assignments/policy";
import type { AssignmentStatus, AssignmentType } from "@/domain/assignments/policy";
import type { Clock } from "@/application/ports/clock";

import { rebuildMembershipState } from "./rebuild-membership";
import type { AssignmentCommandRepository, AssignmentRosterSyncPort } from "./ports";

export class UpsertAssignmentUseCase {
  constructor(
    private readonly repository: AssignmentCommandRepository,
    private readonly rosterSync: AssignmentRosterSyncPort,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    assignmentId?: string;
    userId: string;
    serverDiscordId: string;
    type: AssignmentType;
    status: AssignmentStatus;
    membershipCategoryId?: string;
    primaryGroupId?: string;
    secondaryGroupIds: string[];
    paused: boolean;
    pausedNote?: string;
  }) {
    const [serverExists, userExists] = await Promise.all([
      this.repository.serverExists(input.serverDiscordId),
      this.repository.userExists(input.userId),
    ]);

    if (!serverExists || !userExists) {
      throw new Error("Server or user not found.");
    }

    const groupNameById = await this.repository.listGroupNamesByServer(input.serverDiscordId);
    validateAssignmentGroupIds({
      primaryGroupId: input.primaryGroupId,
      secondaryGroupIds: input.secondaryGroupIds,
      validGroupIds: new Set(groupNameById.keys()),
    });

    const duplicate = await this.repository.getByServerUser(input.serverDiscordId, input.userId);
    if (duplicate && duplicate.id !== input.assignmentId) {
      throw new Error("This user is already assigned to this server.");
    }

    const now = this.clock.now();
    const assignmentId = await this.repository.save({
      assignmentId: input.assignmentId,
      userId: input.userId,
      serverId: input.serverDiscordId,
      type: input.type,
      status: input.status,
      membershipCategoryId: input.membershipCategoryId,
      primaryGroupId: input.primaryGroupId,
      secondaryGroupIds: input.secondaryGroupIds.filter((groupId) => groupId !== input.primaryGroupId),
      paused: input.paused,
      pausedNote: input.pausedNote,
      nowIso: now.toISOString(),
    });

    await rebuildMembershipState(this.repository, input.serverDiscordId, [input.userId], now);

    const eventIds = await this.repository.listOpenMatchEventIds(input.serverDiscordId, now);
    for (const eventId of eventIds) {
      await this.rosterSync.syncEvent(eventId);
    }

    return assignmentId;
  }
}
