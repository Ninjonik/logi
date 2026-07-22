import { mergeImportedSecondaryGroupIds, validateAssignmentGroupIds } from "@/domain/assignments/policy";
import type { Clock } from "@/application/ports/clock";

import { rebuildMembershipState } from "./rebuild-membership";
import type { AssignmentCommandRepository, AssignmentRosterSyncPort } from "./ports";

export class ImportDiscordMembersUseCase {
  constructor(
    private readonly repository: AssignmentCommandRepository,
    private readonly rosterSync: AssignmentRosterSyncPort,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    serverDiscordId: string;
    assignmentType: "member" | "mercenary";
    members: Array<{
      userId: string;
      name: string;
      avatar: string;
      secondaryGroupIds: string[];
    }>;
  }) {
    const serverExists = await this.repository.serverExists(input.serverDiscordId);
    if (!serverExists) {
      throw new Error("Server not found.");
    }

    const groupNameById = await this.repository.listGroupNamesByServer(input.serverDiscordId);
    const validGroupIds = new Set(groupNameById.keys());
    const now = this.clock.now();
    const nowIso = now.toISOString();

    let createdUsers = 0;
    let updatedUsers = 0;
    let createdAssignments = 0;
    let updatedAssignments = 0;

    for (const member of input.members) {
      validateAssignmentGroupIds({
        secondaryGroupIds: member.secondaryGroupIds,
        validGroupIds,
      });

      const userResult = await this.repository.upsertImportedUser({
        userId: member.userId,
        name: member.name,
        avatar: member.avatar,
        nowIso,
      });
      if (userResult === "created") {
        createdUsers += 1;
      } else {
        updatedUsers += 1;
      }

      const existingAssignment = await this.repository.getByServerUser(input.serverDiscordId, member.userId);
      const primaryGroupId = existingAssignment?.primaryGroupId;
      const mergedSecondaryGroupIds = mergeImportedSecondaryGroupIds({
        primaryGroupId,
        existingSecondaryGroupIds: existingAssignment?.secondaryGroupIds ?? [],
        importedSecondaryGroupIds: member.secondaryGroupIds,
      });

      if (existingAssignment) {
        await this.repository.save({
          assignmentId: existingAssignment.id,
          userId: existingAssignment.userId,
          serverId: input.serverDiscordId,
          type: existingAssignment.type ?? input.assignmentType,
          status: existingAssignment.status ?? "active",
          membershipCategoryId: existingAssignment.membershipCategoryId,
          primaryGroupId,
          secondaryGroupIds: mergedSecondaryGroupIds,
          paused: existingAssignment.paused,
          pausedNote: existingAssignment.pausedNote,
          nowIso,
        });
        updatedAssignments += 1;
      } else {
        await this.repository.save({
          userId: member.userId,
          serverId: input.serverDiscordId,
          type: input.assignmentType,
          status: "active",
          membershipCategoryId: undefined,
          primaryGroupId: undefined,
          secondaryGroupIds: mergedSecondaryGroupIds,
          paused: false,
          pausedNote: undefined,
          nowIso,
        });
        createdAssignments += 1;
      }
    }

    const touchedUserIds = [...new Set(input.members.map((member) => member.userId))];
    await rebuildMembershipState(this.repository, input.serverDiscordId, touchedUserIds, now);

    const eventIds = await this.repository.listOpenMatchEventIds(input.serverDiscordId, now);
    for (const eventId of eventIds) {
      await this.rosterSync.syncEvent(eventId);
    }

    return {
      importedCount: input.members.length,
      createdUsers,
      updatedUsers,
      createdAssignments,
      updatedAssignments,
    };
  }
}
