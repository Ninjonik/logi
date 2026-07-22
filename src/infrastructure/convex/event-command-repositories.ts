import type { Id } from "../../../convex/_generated/dataModel";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { EventScoreRepository } from "@/application/events/apply-event-score.use-case";
import type { EventLike } from "@/domain/events/types";
import type { RosterScoreSettings } from "@/domain/events/score-policy";

import type { EventCommandRecord, EventCommandRepository, EventScorePort } from "@/application/events/command-ports";

export class ConvexEventCommandRepository implements EventCommandRepository {
  constructor(private readonly ctx: MutationCtx) {}

  async getById(eventId: string): Promise<EventCommandRecord | null> {
    const event = await this.ctx.db.get(eventId as Id<"events">);
    return event ? ({ id: String(event._id), ...event } as EventCommandRecord) : null;
  }

  async listAll(): Promise<EventCommandRecord[]> {
    const events = await this.ctx.db.query("events").collect();
    return events.map((event) => ({ id: String(event._id), ...event })) as EventCommandRecord[];
  }

  async create(input: Record<string, unknown>): Promise<string> {
    const eventId = await this.ctx.db.insert("events", input as any);
    return String(eventId);
  }

  async update(eventId: string, patch: Record<string, unknown>): Promise<void> {
    await this.ctx.db.patch(eventId as Id<"events">, patch as any);
  }

  async updateStatus(eventId: string, patch: {
    status: "registration" | "closed" | "starting" | "concluded";
    statusUpdatedAt: string;
    concludedAt?: string;
    eventResult?: EventLike["eventResult"];
    matchStatsId?: EventLike["matchStatsId"];
    attendanceReminderLog?: EventLike["attendanceReminderLog"];
    participants?: EventLike["participants"];
    signUps?: EventLike["signUps"];
    scoreAppliedAt?: string;
    scoreResolution?: "applied" | "skipped";
    absenceNotices?: EventLike["absenceNotices"];
    updatedAt: string;
  }): Promise<void> {
    await this.ctx.db.patch(eventId as Id<"events">, patch as any);
  }
}

export class DelegatingEventScorePort implements EventScorePort {
  constructor(private readonly apply: (eventId: string) => Promise<void>) {}

  async applyScoreToEventSignups(eventId: string): Promise<void> {
    await this.apply(eventId);
  }
}

export class ConvexEventScoreRepository implements EventScoreRepository {
  constructor(
    private readonly ctx: MutationCtx,
    private readonly defaultScoreSettings: RosterScoreSettings,
  ) {}

  async getEvent(eventId: string) {
    const event = await this.ctx.db.get(eventId as Id<"events">);
    if (!event) {
      return null;
    }

    return {
      id: String(event._id),
      guildId: event.guildId,
      meetingStart: event.meetingStart,
      status: event.status ?? "registration",
      participants: event.participants ?? [],
      absenceNotices: event.absenceNotices ?? [],
      scoreResolution: event.scoreResolution,
      concludedAt: event.concludedAt,
    };
  }

  async getRoster(eventId: string) {
    const roster = await this.ctx.db
      .query("rosters")
      .withIndex("eventId", (q) => q.eq("eventId", eventId as Id<"events">))
      .unique();

    return roster
      ? {
          squads: roster.squads,
          reservePlayerIds: roster.reservePlayerIds,
          reserveAttendances: roster.reserveAttendances ?? [],
        }
      : null;
  }

  async listAssignments(serverDiscordId: string) {
    return await this.ctx.db
      .query("userAssignments")
      .withIndex("serverId", (q) => q.eq("serverId", serverDiscordId))
      .collect();
  }

  async getScoreSettings(serverDiscordId: string) {
    const config = await this.ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", serverDiscordId))
      .unique();

    return config?.membershipSettings?.rosterScoreSettings ?? this.defaultScoreSettings;
  }

  async getUsers(userIds: string[]) {
    const uniqueIds = [...new Set(userIds)];
    const users = await Promise.all(uniqueIds.map(async (userId) => {
      const user = await this.ctx.db
        .query("users")
        .withIndex("discordId", (q) => q.eq("discordId", userId))
        .unique();

      return user
        ? {
            id: String(user._id),
            userId,
            score: user.score,
            scores: user.scores ?? {},
          }
        : null;
    }));

    return users.filter((user): user is NonNullable<typeof user> => Boolean(user));
  }

  async updateUserScore(userId: string, patch: { score: number; scores: Record<string, number> }) {
    const user = await this.ctx.db
      .query("users")
      .withIndex("discordId", (q) => q.eq("discordId", userId))
      .unique();

    if (!user) {
      return;
    }

    await this.ctx.db.patch(user._id, {
      score: patch.score,
      scores: patch.scores,
      updatedAt: new Date().toISOString(),
    });
  }

  async markEventScoreApplied(eventId: string) {
    await this.ctx.db.patch(eventId as Id<"events">, {
      scoreAppliedAt: new Date().toISOString(),
      scoreResolution: "applied",
      updatedAt: new Date().toISOString(),
    });
  }

  async markEventScoreSkipped(eventId: string) {
    await this.ctx.db.patch(eventId as Id<"events">, {
      scoreResolution: "skipped",
      updatedAt: new Date().toISOString(),
    });
  }
}
