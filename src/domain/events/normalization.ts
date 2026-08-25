import { normalizeOptionalArray } from "@/domain/shared/collections";

import { normalizeParticipants, participantsToSignUps } from "./participants";
import { deriveEventStatus, normalizeEventTimestamps, resolveCreateForumChannel } from "./status";
import type { EventLike } from "./types";

export function normalizeEventRecord<
  T extends EventLike,
>(event: T, now: Date = new Date()) {
  const nowIso = now.toISOString();
  const status = deriveEventStatus(event, now);
  const timestamps = normalizeEventTimestamps(event, nowIso);
  const participants = normalizeParticipants(event.participants, event.signUps, timestamps.updatedAt);
  const matchStatsId = event.matchStatsId;

  return {
    ...event,
    kind: event.kind ?? "match",
    matchType: event.matchType?.trim() || undefined,
    thumbnailUrl: event.thumbnailUrl,
    imageUrl: event.imageUrl,
    meetingChannelId: event.meetingChannelId,
    requiredRoleIds: normalizeOptionalArray(event.requiredRoleIds),
    rewardRoleIds: normalizeOptionalArray(event.rewardRoleIds),
    stratmapIds: normalizeOptionalArray(event.stratmapIds),
    signupGroupIds: event.kind === "training" ? [] : normalizeOptionalArray(event.signupGroupIds),
    allowedSignupStatuses: event.kind === "training" ? undefined : normalizeOptionalArray(event.allowedSignupStatuses),
    useGeneralSignup: event.kind === "match" ? Boolean(event.useGeneralSignup) : false,
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
