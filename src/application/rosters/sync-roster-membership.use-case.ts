import type { Clock } from "@/application/ports/clock";
import type { AssignmentRepository, EventRepository, RosterRepository } from "@/application/ports/repositories";
import { mergeRosterWithEventState, syncRosterMembershipForUser } from "@/domain/rosters/sync";

export class SyncRosterMembershipForEventUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly rosters: RosterRepository,
    private readonly assignments: AssignmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(eventId: string) {
    const [event, roster] = await Promise.all([
      this.events.getById(eventId),
      this.rosters.getByEventId(eventId),
    ]);

    if (!event || !roster || (event.kind ?? "match") !== "match" || !("guildId" in event)) {
      return false;
    }

    const assignments = await this.assignments.listByServer(String(event.guildId));
    const next = mergeRosterWithEventState(roster, {
      guildId: String(event.guildId),
      registrationEnd: event.registrationEnd,
      participants: event.participants,
      signUps: event.signUps,
      updatedAt: event.updatedAt,
      createdAt: event.createdAt,
    }, assignments, this.clock.now());

    await this.rosters.saveForEvent(eventId, next);
    return true;
  }
}

export class SyncRosterMembershipForUserUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly rosters: RosterRepository,
    private readonly assignments: AssignmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(eventId: string, userId: string) {
    const [event, roster] = await Promise.all([
      this.events.getById(eventId),
      this.rosters.getByEventId(eventId),
    ]);

    if (!event || !roster || (event.kind ?? "match") !== "match" || !("guildId" in event)) {
      return false;
    }

    const assignments = await this.assignments.listByServer(String(event.guildId));
    const next = syncRosterMembershipForUser(roster, {
      guildId: String(event.guildId),
      registrationEnd: event.registrationEnd,
      participants: event.participants,
      signUps: event.signUps,
      updatedAt: event.updatedAt,
      createdAt: event.createdAt,
    }, assignments, userId, this.clock.now());

    await this.rosters.saveForEvent(eventId, next);
    return true;
  }
}
