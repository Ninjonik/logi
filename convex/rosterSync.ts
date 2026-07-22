import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { SyncRosterMembershipForEventUseCase, SyncRosterMembershipForUserUseCase } from "../src/application/rosters/sync-roster-membership.use-case";
import { systemClock } from "../src/domain/shared/clock";
import { ConvexAssignmentRepository, ConvexEventRepository, ConvexRosterRepository } from "../src/infrastructure/convex/roster-sync-repositories";
import { mergeRosterWithEventState as mergeRosterWithEventStateShared } from "../src/domain/rosters/sync";
export function mergeRosterWithEventState(roster: any, event: any, assignments: any[]) {
  return mergeRosterWithEventStateShared(roster, event, assignments, new Date());
}

export async function syncRosterMembershipForUser(
  ctx: MutationCtx,
  eventId: Id<"events">,
  userId: string,
) {
  const useCase = new SyncRosterMembershipForUserUseCase(
    new ConvexEventRepository(ctx),
    new ConvexRosterRepository(ctx),
    new ConvexAssignmentRepository(ctx),
    systemClock,
  );
  return await useCase.execute(String(eventId), userId);
}

export async function syncRosterMembershipForEvent(
  ctx: MutationCtx,
  eventId: Id<"events">,
) {
  const useCase = new SyncRosterMembershipForEventUseCase(
    new ConvexEventRepository(ctx),
    new ConvexRosterRepository(ctx),
    new ConvexAssignmentRepository(ctx),
    systemClock,
  );
  return await useCase.execute(String(eventId));
}
