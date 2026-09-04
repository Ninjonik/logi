import { normalizeOptionalArray } from "@/domain/shared/collections";

import { normalizeParticipants } from "./participants";
import { deriveEventStatus } from "./status";
import type { EventKind, EventLike, EventStatus, SignupMembershipStatus } from "./types";

export type EventUpsertInput = {
  guildId: string;
  kind?: EventKind;
  matchType?: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  announcementChannelId?: string;
  eventInfoChannelId?: string;
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
  pingMode?: "none" | "clan" | "roles";
  pingRoleIds?: string[];
  createForumChannel?: boolean;
  topicPresetId?: string;
  stratmapIds?: string[];
  signupGroupIds?: string[];
  allowedSignupStatuses?: SignupMembershipStatus[];
  useGeneralSignup?: boolean;
};

function trimOptional(value: string | undefined) {
  return value?.trim() || undefined;
}

export function buildEventBasePayload(input: EventUpsertInput) {
  const kind = input.kind ?? "match";

  return {
    guildId: input.guildId,
    kind,
    matchType: trimOptional(input.matchType),
    name: input.name.trim(),
    description: trimOptional(input.description),
    thumbnailUrl: trimOptional(input.thumbnailUrl),
    imageUrl: trimOptional(input.imageUrl),
    announcementChannelId: trimOptional(input.announcementChannelId),
    eventInfoChannelId: kind === "match" ? trimOptional(input.eventInfoChannelId) : undefined,
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
    pingMode: input.pingMode ?? (input.pingClan ? "clan" : "none"),
    pingRoleIds: normalizeOptionalArray(input.pingRoleIds).map((roleId) => roleId.trim()).filter(Boolean),
    createForumChannel: kind === "training" ? false : input.createForumChannel ?? true,
    topicPresetId: input.topicPresetId,
    stratmapIds: normalizeOptionalArray(input.stratmapIds).map((id) => id.trim()).filter(Boolean),
    signupGroupIds: kind === "training" ? [] : normalizeOptionalArray(input.signupGroupIds).map((id) => id.trim()).filter(Boolean),
    allowedSignupStatuses: kind === "training" ? undefined : normalizeOptionalArray(input.allowedSignupStatuses).filter((status): status is SignupMembershipStatus => Boolean(status)),
    useGeneralSignup: kind === "match" ? Boolean(input.useGeneralSignup) : false,
  };
}

export function buildCreateEventRecord(input: EventUpsertInput, now: Date) {
  const nowIso = now.toISOString();
  const base = buildEventBasePayload(input);
  const derivedStatus: EventStatus = deriveEventStatus({
    registrationEnd: input.registrationEnd,
    meetingStart: input.meetingStart,
    gameEnd: input.gameEnd,
  }, now);

  return {
    ...base,
    status: derivedStatus,
    statusUpdatedAt: nowIso,
    concludedAt: derivedStatus === "concluded" ? nowIso : undefined,
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
  // Discord message locations and recipients are creation-time choices.  The
  // bot persists message IDs per location, so changing either later could
  // update or delete a message belonging to a different event.
  const { announcementChannelId: _announcementChannelId, eventInfoChannelId: _eventInfoChannelId, ...mutableBase } = base;
  const derivedStatus: EventStatus = deriveEventStatus({
    registrationEnd: input.registrationEnd,
    meetingStart: input.meetingStart,
    gameEnd: input.gameEnd,
    status: existing.status,
  }, now);

  return {
    ...mutableBase,
    announcementChannelId: existing.announcementChannelId,
    eventInfoChannelId: existing.eventInfoChannelId,
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
