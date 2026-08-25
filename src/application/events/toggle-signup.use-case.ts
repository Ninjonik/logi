import type { Clock } from "@/application/ports/clock";
import { getResolvedMemberStatus } from "@/domain/assignments/policy";
import { normalizeEventRecord } from "@/domain/events/normalization";
import { toggleSignup } from "@/domain/events/signup-policy";
import { SIGNUP_GENERAL, SIGNUP_NOT_ATTENDING } from "@/domain/events/types";

import type { EventWorkflowRepository, EventWorkflowSyncPort } from "./ports";

export class ToggleSignupUseCase {
  constructor(
    private readonly events: EventWorkflowRepository,
    private readonly rosterSync: EventWorkflowSyncPort,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    eventId: string;
    userId: string;
    group: string | null;
  }) {
    const event = await this.events.getById(input.eventId);
    if (!event) {
      throw new Error("Event not found.");
    }

    const now = this.clock.now();
    const normalizedEvent = normalizeEventRecord(event, now);
    let nextGroup = input.group;
    const assignment = await this.events.getAssignmentForUser(normalizedEvent.guildId, input.userId);
    const resolvedMembershipStatus = assignment?.type && assignment.status
      ? getResolvedMemberStatus(assignment.type, assignment.status)
      : null;
    const membershipStatus = resolvedMembershipStatus && resolvedMembershipStatus !== "pending"
      ? resolvedMembershipStatus
      : null;

    if (normalizedEvent.kind === "match" && input.group === SIGNUP_GENERAL) {
      const primaryGroupId = assignment?.primaryGroupId;
      const allowedGroupIds = new Set(normalizedEvent.signupGroupIds ?? []);

      if (primaryGroupId && allowedGroupIds.has(primaryGroupId)) {
        nextGroup = await this.events.getGroupNameById(primaryGroupId);
      } else {
        nextGroup = null;
      }
    }

    const next = toggleSignup({
      participants: normalizedEvent.participants,
      event: normalizedEvent,
      userId: input.userId,
      group: nextGroup,
      now,
      membershipStatus,
    });

    await this.events.saveSignupState(input.eventId, {
      participants: next.participants,
      signUps: next.signUps,
      updatedAt: now.toISOString(),
    });
    await this.rosterSync.syncRosterMembershipForUser(input.eventId, input.userId);

    return {
      signUps: next.signUps,
      appliedSignupLabel: input.group === SIGNUP_NOT_ATTENDING ? SIGNUP_NOT_ATTENDING : (nextGroup ?? SIGNUP_GENERAL),
      removed: next.removed,
    };
  }
}
