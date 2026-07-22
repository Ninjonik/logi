import type { Clock } from "@/application/ports/clock";

import { rebuildMembershipState } from "./rebuild-membership";
import type { AssignmentCommandRepository, AssignmentRosterSyncPort } from "./ports";

export class RemoveAssignmentUseCase {
  constructor(
    private readonly repository: AssignmentCommandRepository,
    private readonly rosterSync: AssignmentRosterSyncPort,
    private readonly clock: Clock,
  ) {}

  async execute(assignmentId: string) {
    const assignment = await this.repository.getById(assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found.");
    }

    await this.repository.remove(assignmentId);

    const now = this.clock.now();
    await rebuildMembershipState(this.repository, assignment.serverId, [assignment.userId], now);

    const eventIds = await this.repository.listOpenMatchEventIds(assignment.serverId, now);
    for (const eventId of eventIds) {
      await this.rosterSync.syncEvent(eventId);
    }

    return { ok: true as const };
  }
}
