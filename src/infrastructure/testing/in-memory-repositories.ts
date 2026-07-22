import type { AssignmentRepository, AssignmentRepositoryRecord, EventRepository, RosterRepository } from "@/application/ports/repositories";
import type { EventLike } from "@/domain/events/types";
import type { RosterLike } from "@/domain/rosters/types";

export class InMemoryEventRepository<TEvent extends EventLike & { id: string; guildId?: string }> implements EventRepository<TEvent> {
  constructor(private readonly events: Map<string, TEvent>) {}

  async getById(eventId: string): Promise<TEvent | null> {
    return this.events.get(eventId) ?? null;
  }
}

export class InMemoryRosterRepository<TRoster extends RosterLike & { eventId: string }> implements RosterRepository<TRoster> {
  constructor(private readonly rosters: Map<string, TRoster>) {}

  async getByEventId(eventId: string): Promise<TRoster | null> {
    return this.rosters.get(eventId) ?? null;
  }

  async saveForEvent(eventId: string, roster: TRoster): Promise<void> {
    this.rosters.set(eventId, roster);
  }
}

export class InMemoryAssignmentRepository implements AssignmentRepository {
  constructor(private readonly assignments: AssignmentRepositoryRecord[]) {}

  async listByServer(serverId: string): Promise<AssignmentRepositoryRecord[]> {
    return this.assignments.filter((assignment) => assignment.serverId === serverId);
  }
}
