import { normalizeOptionalArray } from "@/domain/shared/collections";

import { normalizeParticipants, participantsToSignUps } from "./participants";
import { deriveEventStatus, normalizeEventTimestamps, resolveCreateForumChannel } from "./status";
import type { EventLike } from "./types";

export function normalizeEventRecord<
  T extends EventLike,
>(event: T, now: Date = new Date()) {
  const nowIso = now.toISOString();
  const status = event.status ?? deriveEventStatus(event, now);
  const timestamps = normalizeEventTimestamps(event, nowIso);
  const participants = normalizeParticipants(event.participants, event.signUps, timestamps.updatedAt);
  const matchStatsId = event.matchStatsId;

  return {
    ...event,
    kind: event.kind ?? "match",
    thumbnailUrl: event.thumbnailUrl,
    meetingChannelId: event.meetingChannelId,
    requiredRoleIds: normalizeOptionalArray(event.requiredRoleIds),
    rewardRoleIds: normalizeOptionalArray(event.rewardRoleIds),
    createForumChannel: resolveCreateForumChannel(event),
    status,
    statusUpdatedAt: timestamps.statusUpdatedAt,
    concludedAt: event.concludedAt,
    eventResult: event.eventResult,
    matchStatsId,
    attendanceReminderLog: normalizeOptionalArray(event.attendanceReminderLog),
    participants,
    signUps: participantsToSignUps(participants),
    scoreAppliedAt: event.scoreAppliedAt,
    scoreResolution: event.scoreResolution,
    absenceNotices: normalizeOptionalArray(event.absenceNotices),
    updatedAt: timestamps.updatedAt,
  };
}
