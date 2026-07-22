import type { EventNotice, EventParticipant, EventSignup, EventStatus } from "@/domain/events/types";

export type EventWorkflowRecord = {
  id: string;
  guildId: string;
  kind?: "match" | "training";
  registrationEnd: string;
  meetingStart: string;
  gameEnd: string;
  status?: EventStatus;
  participants?: EventParticipant[];
  signUps?: EventSignup[];
  absenceNotices?: EventNotice[];
  updatedAt?: string;
  createdAt?: string;
};

export interface EventWorkflowRepository {
  getById(eventId: string): Promise<EventWorkflowRecord | null>;
  saveSignupState(eventId: string, input: {
    participants: EventParticipant[];
    signUps: EventSignup[];
    updatedAt: string;
  }): Promise<void>;
  saveAbsenceNotices(eventId: string, input: {
    absenceNotices: EventNotice[];
    updatedAt: string;
  }): Promise<void>;
}

export interface EventWorkflowSyncPort {
  syncRosterMembershipForUser(eventId: string, userId: string): Promise<void>;
}
