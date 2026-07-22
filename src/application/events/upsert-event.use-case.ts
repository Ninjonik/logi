import type { Clock } from "@/application/ports/clock";
import { buildCreateEventRecord, buildUpdateEventPatch } from "@/domain/events/upsert-policy";

import type { EventCommandRepository, EventScorePort, EventUpsertCommand } from "./command-ports";

export class UpsertEventUseCase {
  constructor(
    private readonly events: EventCommandRepository,
    private readonly scores: EventScorePort,
    private readonly clock: Clock,
  ) {}

  async execute(input: EventUpsertCommand): Promise<string> {
    const now = this.clock.now();

    if (input.eventId) {
      const existing = await this.events.getById(input.eventId);
      if (!existing) {
        throw new Error("Event not found.");
      }

      const patch = buildUpdateEventPatch(existing, input, now);
      await this.events.update(input.eventId, patch);

      if (patch.status !== "registration") {
        await this.scores.applyScoreToEventSignups(input.eventId);
      }

      return input.eventId;
    }

    const created = buildCreateEventRecord(input, now);
    return await this.events.create(created);
  }
}
