import type { Id } from "../../../convex/_generated/dataModel";
import type { MutationCtx } from "../../../convex/_generated/server";

import type { RosterCommandRepository } from "@/application/rosters/roster-commands.use-case";

export class ConvexRosterCommandRepository implements RosterCommandRepository {
  constructor(private readonly ctx: MutationCtx) {}

  async getRosterById(rosterId: string) {
    const roster = await this.ctx.db.get(rosterId as Id<"rosters">);
    return roster ? { id: String(roster._id), ...roster } : null;
  }

  async getRosterByEventId(eventId: string) {
    const roster = await this.ctx.db.query("rosters").withIndex("eventId", (q) => q.eq("eventId", eventId as Id<"events">)).unique();
    return roster ? { id: String(roster._id), ...roster } : null;
  }

  async getEvent(eventId: string) {
    const event = await this.ctx.db.get(eventId as Id<"events">);
    return event ? { ...event } : null;
  }

  async listAssignments(serverDiscordId: string) {
    return await this.ctx.db.query("userAssignments").withIndex("serverId", (q) => q.eq("serverId", serverDiscordId)).collect();
  }

  async createRoster(roster: any) {
    const now = new Date().toISOString();
    const id = await this.ctx.db.insert("rosters", {
      ...roster,
      createdAt: now,
      updatedAt: now,
    });
    return String(id);
  }

  async updateRoster(rosterId: string, roster: any) {
    await this.ctx.db.patch(rosterId as Id<"rosters">, {
      ...roster,
      updatedAt: new Date().toISOString(),
    });
  }
}
