import { normalizeOptionalArray } from "@/domain/shared/collections";

import { normalizeParticipants } from "./participants";
import { deriveEventStatus } from "./status";
import type { EventKind, EventLike, EventStatus } from "./types";

export type EventUpsertInput = {
  guildId: string;
  kind?: EventKind;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  meetingChannelId?: string;
  requiredRoleIds?: string[];
  rewardRoleIds?: string[];
  server?: string;
  serverPassword?: string;
  side?: string;
  map?: string;
  cap?: string;
  notes?: string;
  registrationEnd: string;
  meetingStart: string;
  gameStart: string;
  gameEnd: string;
  pingClan: boolean;
  createForumChannel?: boolean;
  topicPresetId?: string;
};

function trimOptional(value: string | undefined) {
  return value?.trim() || undefined;
}

export function buildEventBasePayload(input: EventUpsertInput) {
  const kind = input.kind ?? "match";

  return {
    guildId: input.guildId,
    kind,
    name: input.name.trim(),
    description: trimOptional(input.description),
    thumbnailUrl: trimOptional(input.thumbnailUrl),
    meetingChannelId: trimOptional(input.meetingChannelId),
    requiredRoleIds: normalizeOptionalArray(input.requiredRoleIds).map((roleId) => roleId.trim()).filter(Boolean),
    rewardRoleIds: normalizeOptionalArray(input.rewardRoleIds).map((roleId) => roleId.trim()).filter(Boolean),
    server: trimOptional(input.server),
    serverPassword: trimOptional(input.serverPassword),
    side: trimOptional(input.side),
    map: trimOptional(input.map),
    cap: trimOptional(input.cap),
    notes: trimOptional(input.notes),
    registrationEnd: input.registrationEnd,
    meetingStart: input.meetingStart,
    gameStart: input.gameStart,
    gameEnd: input.gameEnd,
    pingClan: input.pingClan,
    createForumChannel: kind === "training" ? false : input.createForumChannel ?? true,
    topicPresetId: input.topicPresetId,
  };
}

export function buildCreateEventRecord(input: EventUpsertInput, now: Date) {
  const nowIso = now.toISOString();
  const base = buildEventBasePayload(input);

  return {
    ...base,
    status: "registration" as const,
    statusUpdatedAt: nowIso,
    attendanceReminderLog: [],
    participants: [],
    signUps: [],
    scoreAppliedAt: undefined,
    scoreResolution: undefined,
    absenceNotices: [],
    eventResult: undefined,
    matchStatsId: undefined,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function buildUpdateEventPatch(
  existing: EventLike,
  input: EventUpsertInput,
  now: Date,
) {
  const nowIso = now.toISOString();
  const base = buildEventBasePayload(input);
  const derivedStatus: EventStatus = deriveEventStatus({
    registrationEnd: input.registrationEnd,
    meetingStart: input.meetingStart,
    gameEnd: input.gameEnd,
    status: existing.status,
  }, now);

  return {
    ...base,
    status: derivedStatus,
    statusUpdatedAt: nowIso,
    concludedAt: derivedStatus === "concluded" ? existing.concludedAt ?? nowIso : undefined,
    eventResult: existing.eventResult,
    matchStatsId: existing.matchStatsId,
    attendanceReminderLog: normalizeOptionalArray(existing.attendanceReminderLog),
    participants: normalizeParticipants(existing.participants, existing.signUps, nowIso),
    signUps: normalizeOptionalArray(existing.signUps),
    scoreAppliedAt: existing.scoreAppliedAt,
    scoreResolution: existing.scoreResolution,
    absenceNotices: normalizeOptionalArray(existing.absenceNotices),
    updatedAt: nowIso,
  };
}
