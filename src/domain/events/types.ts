export type EventStatus = "registration" | "closed" | "starting" | "concluded";
export type EventKind = "match" | "training";
export type ParticipantStatus = "attending" | "not_attending";
export type ParticipantCompletionStatus = "passed" | "failed";

export const SIGNUP_NOT_ATTENDING = "NOT_ATTENDING";
export const SIGNUP_ATTENDING = "ATTENDING";

export type EventParticipant = {
  userId: string;
  status: ParticipantStatus;
  group?: string | null;
  completed?: ParticipantCompletionStatus;
  updatedAt: string;
};

export type EventSignup = {
  userId: string;
  group?: string | null;
};

export type EventNotice = {
  userId: string;
  reason: string;
  createdAt: string;
};

export type EventResult = {
  sourceUrl: string;
  mapId: string;
  mapName?: string;
  endedAt?: string;
  importedAt: string;
  sideA: string;
  sideB: string;
  outcome: "victory" | "defeat" | "draw";
  score: {
    sideA: number;
    sideB: number;
  };
};

export type AttendanceReminder = {
  userId: string;
  offsetHours: number;
  sentAt: string;
};

export type EventLike = {
  registrationEnd: string;
  meetingStart: string;
  gameEnd: string;
  kind?: EventKind;
  createForumChannel?: boolean;
  status?: EventStatus;
  statusUpdatedAt?: string;
  concludedAt?: string;
  attendanceReminderLog?: AttendanceReminder[];
  participants?: EventParticipant[];
  signUps?: EventSignup[];
  scoreAppliedAt?: string;
  scoreResolution?: "applied" | "skipped";
  absenceNotices?: EventNotice[];
  eventResult?: EventResult;
  matchStatsId?: unknown;
  createdAt?: string;
  updatedAt?: string;
  thumbnailUrl?: string;
  meetingChannelId?: string;
  requiredRoleIds?: string[];
  rewardRoleIds?: string[];
};
