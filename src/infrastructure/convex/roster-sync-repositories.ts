import type { Id } from "../../../convex/_generated/dataModel";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { AssignmentRepository, AssignmentRepositoryRecord, EventRepository, RosterRepository } from "@/application/ports/repositories";
import type { EventLike } from "@/domain/events/types";
import type { RosterLike } from "@/domain/rosters/types";

type ConvexEventRecord = EventLike & {
  _id: Id<"events">;
  guildId: string;
};

type ConvexRosterRecord = RosterLike & {
  _id: Id<"rosters">;
  eventId: Id<"events">;
  squadPresetId?: Id<"squadPresets">;
  createdAt?: string;
  updatedAt?: string;
};

export class ConvexEventRepository implements EventRepository<ConvexEventRecord> {
  constructor(private readonly ctx: MutationCtx) {}

  async getById(eventId: string): Promise<ConvexEventRecord | null> {
    return await this.ctx.db.get(eventId as Id<"events">) as ConvexEventRecord | null;
  }
}

export class ConvexRosterRepository implements RosterRepository<ConvexRosterRecord> {
  constructor(private readonly ctx: MutationCtx) {}

  async getByEventId(eventId: string): Promise<ConvexRosterRecord | null> {
    return await this.ctx.db
      .query("rosters")
      .withIndex("eventId", (q) => q.eq("eventId", eventId as Id<"events">))
      .unique() as ConvexRosterRecord | null;
  }

  async saveForEvent(eventId: string, roster: ConvexRosterRecord): Promise<void> {
    const existing = await this.getByEventId(eventId);
    if (!existing) {
      return;
    }

    await this.ctx.db.patch(existing._id, {
      squads: roster.squads,
      reservePlayerIds: roster.reservePlayerIds,
      reserveAttendances: roster.reserveAttendances ?? [],
      notAttendingPlayerIds: roster.notAttendingPlayerIds,
      updatedAt: new Date().toISOString(),
    });
  }
}

export class ConvexAssignmentRepository implements AssignmentRepository {
  constructor(private readonly ctx: MutationCtx) {}

  async listByServer(serverId: string): Promise<AssignmentRepositoryRecord[]> {
    return await this.ctx.db
      .query("userAssignments")
      .withIndex("serverId", (q) => q.eq("serverId", serverId))
      .collect() as AssignmentRepositoryRecord[];
  }
}
