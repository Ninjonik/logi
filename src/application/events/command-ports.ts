import type { EventLike } from "@/domain/events/types";
import type { EventUpsertInput } from "@/domain/events/upsert-policy";

export type EventCommandRecord = EventLike & {
  id: string;
  name?: string;
  guildId?: string;
  meetingStart?: string;
};

export interface EventCommandRepository {
  getById(eventId: string): Promise<EventCommandRecord | null>;
  listAll(): Promise<EventCommandRecord[]>;
  create(input: ReturnType<typeof import("@/domain/events/upsert-policy").buildCreateEventRecord>): Promise<string>;
  update(eventId: string, patch: Record<string, unknown>): Promise<void>;
  updateStatus(eventId: string, patch: {
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
  }): Promise<void>;
}

export interface EventScorePort {
  applyScoreToEventSignups(eventId: string): Promise<void>;
}

export type EventUpsertCommand = Omit<EventUpsertInput, "guildId"> & {
  guildId: string;
  eventId?: string;
};
