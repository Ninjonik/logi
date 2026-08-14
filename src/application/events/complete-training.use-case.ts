import type { Clock } from "@/application/ports/clock";

import type { EventCommandRepository, EventScorePort, TrainingCompletionInput } from "./command-ports";

export class CompleteTrainingUseCase {
  constructor(
    private readonly events: EventCommandRepository,
    private readonly scores: EventScorePort,
    private readonly clock: Clock,
  ) {}

  async execute(eventId: string, input: {
    participants: TrainingCompletionInput[];
  }) {
    const event = await this.events.getById(eventId);
    if (!event) {
      throw new Error("Event not found.");
    }

    if ((event.kind ?? "match") !== "training") {
      throw new Error("Only training events can be completed with attendee results.");
    }

    const participantByUserId = new Map(input.participants.map((participant) => [participant.userId, participant.completed]));
    const attendingParticipants = (event.participants ?? []).filter((participant) => participant.status === "attending");

    for (const participant of attendingParticipants) {
      if (!participantByUserId.has(participant.userId)) {
        throw new Error("Each attending participant must have a completion result.");
      }
    }

    const nowIso = this.clock.now().toISOString();
    const nextParticipants = (event.participants ?? []).map((participant) => {
      const completed = participantByUserId.get(participant.userId);
      if (!completed) {
        return participant;
      }

      return {
        ...participant,
        completed,
        updatedAt: nowIso,
      };
    });

    await this.events.updateStatus(eventId, {
      status: "concluded",
      statusUpdatedAt: nowIso,
      concludedAt: nowIso,
      participants: nextParticipants,
      updatedAt: nowIso,
    });

    await this.scores.applyScoreToEventSignups(eventId);
    return { ok: true as const };
  }
}
