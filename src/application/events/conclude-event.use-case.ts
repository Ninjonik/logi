import type { Clock } from "@/application/ports/clock";

import type { EventCommandRepository, EventScorePort } from "./command-ports";

export class ConcludeEventUseCase {
  constructor(
    private readonly events: EventCommandRepository,
    private readonly scores: EventScorePort,
    private readonly clock: Clock,
  ) {}

  async execute(eventId: string) {
    const event = await this.events.getById(eventId);
    if (!event) {
      throw new Error("Event not found.");
    }

    const nowIso = this.clock.now().toISOString();
    await this.events.updateStatus(eventId, {
      status: "concluded",
      statusUpdatedAt: nowIso,
      concludedAt: nowIso,
      updatedAt: nowIso,
    });

    await this.scores.applyScoreToEventSignups(eventId);
    return { ok: true as const };
  }
}
