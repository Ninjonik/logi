import type { Clock } from "@/application/ports/clock";
import { normalizeEventRecord } from "@/domain/events/normalization";
import { deriveEventStatus } from "@/domain/events/status";

import type { EventCommandRepository, EventScorePort } from "./command-ports";

export class ReconcileEventStatusesUseCase {
  constructor(
    private readonly events: EventCommandRepository,
    private readonly scores: EventScorePort,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<string[]> {
    const records = await this.events.listAll();
    const now = this.clock.now();
    const nowIso = now.toISOString();
    const changedEventIds: string[] = [];

    for (const event of records) {
      const normalizedEvent = normalizeEventRecord(event, now);
      const nextStatus = deriveEventStatus(normalizedEvent, now);
      const shouldPatch =
        nextStatus !== event.status ||
        !event.statusUpdatedAt ||
        !event.attendanceReminderLog ||
        !event.participants ||
        !event.signUps ||
        (nextStatus === "concluded" && !event.scoreResolution) ||
        !event.updatedAt;

      if (!shouldPatch) {
        continue;
      }

      await this.events.updateStatus(event.id, {
        status: nextStatus,
        statusUpdatedAt: nextStatus !== event.status ? nowIso : normalizedEvent.statusUpdatedAt,
        concludedAt: nextStatus === "concluded" ? event.concludedAt ?? nowIso : undefined,
        eventResult: event.eventResult,
        matchStatsId: event.matchStatsId,
        attendanceReminderLog: normalizedEvent.attendanceReminderLog,
        participants: normalizedEvent.participants,
        signUps: normalizedEvent.signUps,
        scoreAppliedAt: event.scoreAppliedAt,
        scoreResolution: event.scoreResolution,
        absenceNotices: normalizedEvent.absenceNotices,
        updatedAt: nowIso,
      });

      if (nextStatus === "concluded") {
        await this.scores.applyScoreToEventSignups(event.id);
      }

      changedEventIds.push(event.id);
    }

    return changedEventIds;
  }
}
