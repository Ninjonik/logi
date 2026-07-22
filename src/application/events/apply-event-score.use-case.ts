import { resolveRosterScoreDelta, type RosterScoreSettings, type ScorableRoster } from "@/domain/events/score-policy";
import { isEventCancelledBeforeMeeting } from "@/domain/events/status";

export type EventScoreEventRecord = {
  id: string;
  guildId: string;
  meetingStart: string;
  status: "registration" | "closed" | "starting" | "concluded";
  participants: Array<{ userId: string; status: "attending" | "not_attending" }>;
  absenceNotices: Array<{ userId: string; reason: string; createdAt: string }>;
  scoreResolution?: "applied" | "skipped";
  concludedAt?: string;
};

export type EventScoreUserRecord = {
  id: string;
  userId: string;
  score?: number;
  scores?: Record<string, number>;
};

export type EventScoreAssignmentRecord = {
  userId: string;
  paused: boolean;
};

export interface EventScoreRepository {
  getEvent(eventId: string): Promise<EventScoreEventRecord | null>;
  getRoster(eventId: string): Promise<ScorableRoster | null>;
  listAssignments(serverDiscordId: string): Promise<EventScoreAssignmentRecord[]>;
  getScoreSettings(serverDiscordId: string): Promise<RosterScoreSettings>;
  getUsers(userIds: string[]): Promise<EventScoreUserRecord[]>;
  updateUserScore(userId: string, patch: { score: number; scores: Record<string, number> }): Promise<void>;
  markEventScoreApplied(eventId: string): Promise<void>;
  markEventScoreSkipped(eventId: string): Promise<void>;
}

export class ApplyEventScoreUseCase {
  constructor(private readonly repository: EventScoreRepository) {}

  async execute(eventId: string) {
    const event = await this.repository.getEvent(eventId);
    if (!event) {
      throw new Error("Event not found.");
    }

    if (event.scoreResolution || event.status !== "concluded") {
      return false;
    }

    if (isEventCancelledBeforeMeeting(event)) {
      await this.repository.markEventScoreSkipped(eventId);
      return false;
    }

    const [settings, assignments, roster] = await Promise.all([
      this.repository.getScoreSettings(event.guildId),
      this.repository.listAssignments(event.guildId),
      this.repository.getRoster(eventId),
    ]);

    const activeUserIds = assignments.filter((assignment) => !assignment.paused).map((assignment) => assignment.userId);
    const users = await this.repository.getUsers(activeUserIds);

    for (const user of users) {
      const delta = resolveRosterScoreDelta({
        userId: user.userId,
        settings,
        participants: event.participants,
        notices: event.absenceNotices,
        roster,
      });
      const scores = {
        ...(user.scores ?? {}),
        [event.guildId]: (user.scores?.[event.guildId] ?? user.score ?? 0) + delta,
      };

      await this.repository.updateUserScore(user.userId, {
        score: scores[event.guildId],
        scores,
      });
    }

    await this.repository.markEventScoreApplied(eventId);
    return true;
  }
}
