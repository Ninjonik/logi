import type { Clock } from "@/application/ports/clock";
import { normalizeEventRecord } from "@/domain/events/normalization";
import { toggleSignup } from "@/domain/events/signup-policy";

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
    const next = toggleSignup({
      participants: normalizedEvent.participants,
      event: normalizedEvent,
      userId: input.userId,
      group: input.group,
      now,
    });

    await this.events.saveSignupState(input.eventId, {
      participants: next.participants,
      signUps: next.signUps,
      updatedAt: now.toISOString(),
    });
    await this.rosterSync.syncRosterMembershipForUser(input.eventId, input.userId);

    return next.signUps;
  }
}
