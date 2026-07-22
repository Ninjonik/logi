import type { EventLike } from "@/domain/events/types";
import type { RosterLike } from "@/domain/rosters/types";

export type AssignmentRepositoryRecord = {
  userId: string;
  serverId: string;
  createdAt: string;
};

export interface EventRepository<TEvent extends EventLike = EventLike> {
  getById(eventId: string): Promise<TEvent | null>;
}

export interface RosterRepository<TRoster extends RosterLike = RosterLike> {
  getByEventId(eventId: string): Promise<TRoster | null>;
  saveForEvent(eventId: string, roster: TRoster): Promise<void>;
}

export interface AssignmentRepository {
  listByServer(serverId: string): Promise<AssignmentRepositoryRecord[]>;
}
