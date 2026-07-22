import type { Id } from "../../../convex/_generated/dataModel";
import type { MutationCtx } from "../../../convex/_generated/server";
import { SyncRosterMembershipForUserUseCase } from "@/application/rosters/sync-roster-membership.use-case";
import { systemClock } from "@/domain/shared/clock";

import type { EventWorkflowRecord, EventWorkflowRepository, EventWorkflowSyncPort } from "@/application/events/ports";
import { ConvexAssignmentRepository, ConvexEventRepository, ConvexRosterRepository } from "./roster-sync-repositories";

export class ConvexEventWorkflowRepository implements EventWorkflowRepository {
  constructor(private readonly ctx: MutationCtx) {}

  async getById(eventId: string): Promise<EventWorkflowRecord | null> {
    const event = await this.ctx.db.get(eventId as Id<"events">);
    if (!event) {
      return null;
    }

    return {
      id: String(event._id),
      guildId: event.guildId,
      kind: event.kind,
      registrationEnd: event.registrationEnd,
      meetingStart: event.meetingStart,
      gameEnd: event.gameEnd,
      status: event.status,
      participants: event.participants,
      signUps: event.signUps,
      absenceNotices: event.absenceNotices,
      updatedAt: event.updatedAt,
      createdAt: event.createdAt,
    };
  }

  async saveSignupState(eventId: string, input: {
    participants: EventWorkflowRecord["participants"];
    signUps: EventWorkflowRecord["signUps"];
    updatedAt: string;
  }): Promise<void> {
    await this.ctx.db.patch(eventId as Id<"events">, {
      participants: input.participants ?? [],
      signUps: input.signUps ?? [],
      updatedAt: input.updatedAt,
    });
  }

  async saveAbsenceNotices(eventId: string, input: {
    absenceNotices: EventWorkflowRecord["absenceNotices"];
    updatedAt: string;
  }): Promise<void> {
    await this.ctx.db.patch(eventId as Id<"events">, {
      absenceNotices: input.absenceNotices ?? [],
      updatedAt: input.updatedAt,
    });
  }
}

export class ConvexEventWorkflowSyncPort implements EventWorkflowSyncPort {
  constructor(private readonly ctx: MutationCtx) {}

  async syncRosterMembershipForUser(eventId: string, userId: string): Promise<void> {
    const useCase = new SyncRosterMembershipForUserUseCase(
      new ConvexEventRepository(this.ctx),
      new ConvexRosterRepository(this.ctx),
      new ConvexAssignmentRepository(this.ctx),
      systemClock,
    );
    await useCase.execute(eventId, userId);
  }
}
