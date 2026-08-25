import type { EventNotice, EventParticipant, EventSignup, EventStatus } from "@/domain/events/types";

export type EventWorkflowRecord = {
  id: string;
  guildId: string;
  kind?: "match" | "training";
  signupGroupIds?: string[];
  allowedSignupStatuses?: Array<"recruit" | "member" | "reserve_member" | "mercenary">;
  useGeneralSignup?: boolean;
  registrationEnd: string;
  meetingStart: string;
  gameStart?: string;
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
  getAssignmentForUser(serverId: string, userId: string): Promise<{
    primaryGroupId?: string;
    type?: "member" | "reserve_member" | "mercenary";
    status?: "pending" | "recruit" | "active";
  } | null>;
  getGroupNameById(groupId: string): Promise<string | null>;
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
