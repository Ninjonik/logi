import { findEligibleNoticeTargets } from "@/domain/events/notice-policy";
import type { EventLike } from "@/domain/events/types";
import { normalizeEventRecord } from "@/domain/events/normalization";

type ExecuteUseCase<TInput = void, TResult = unknown> = {
  execute(input: TInput): Promise<TResult>;
};

export function assertInternalSecret(secret: string, expectedSecret: string) {
  if (secret !== expectedSecret) {
    throw new Error("Unauthorized.");
  }
}

export async function handleUpsertEvent(input: {
  secret: string;
  expectedSecret: string;
  args: Record<string, unknown> & { secret: string; serverId: string; eventId?: string; topicPresetId?: string };
  getGuildById: (serverId: string) => Promise<{ discordId?: string; id?: string } | null>;
  getGuildDiscordId: (guild: { discordId?: string; id?: string }) => string;
  createUseCase: () => ExecuteUseCase<any, unknown>;
}) {
  assertInternalSecret(input.secret, input.expectedSecret);

  const guild = await input.getGuildById(input.args.serverId);
  if (!guild) {
    throw new Error("Server not found.");
  }

  const { secret: _secret, serverId: _serverId, ...command } = input.args;

  return await input.createUseCase().execute({
    ...command,
    guildId: input.getGuildDiscordId(guild),
    topicPresetId: input.args.topicPresetId ? String(input.args.topicPresetId) : undefined,
  });
}

export async function handleToggleSignup(input: {
  secret: string;
  expectedSecret: string;
  args: { eventId: string; userId: string; group: string | null };
  createUseCase: () => ExecuteUseCase<{ eventId: string; userId: string; group: string | null }, unknown>;
}) {
  assertInternalSecret(input.secret, input.expectedSecret);
  return await input.createUseCase().execute(input.args);
}

export async function handleReconcileStatuses(input: {
  secret: string;
  expectedSecret: string;
  createUseCase: () => ExecuteUseCase<void, unknown>;
}) {
  assertInternalSecret(input.secret, input.expectedSecret);
  return await input.createUseCase().execute(undefined);
}

export async function handleConcludeEvent(input: {
  secret: string;
  expectedSecret: string;
  eventId: string;
  createUseCase: () => ExecuteUseCase<string, unknown>;
}) {
  assertInternalSecret(input.secret, input.expectedSecret);
  return await input.createUseCase().execute(input.eventId);
}

export async function handleAppendAttendanceReminderLog(input: {
  secret: string;
  expectedSecret: string;
  eventId: string;
  reminders: Array<{ userId: string; offsetHours: number; sentAt: string }>;
  getEventById: (eventId: string) => Promise<(Record<string, unknown> & EventLike) | null>;
  patchEvent: (eventId: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  assertInternalSecret(input.secret, input.expectedSecret);

  const event = await input.getEventById(input.eventId);
  if (!event) {
    throw new Error("Event not found.");
  }

  const normalizedEvent = normalizeEventRecord(event);

  await input.patchEvent(input.eventId, {
    attendanceReminderLog: [...normalizedEvent.attendanceReminderLog, ...input.reminders],
    updatedAt: new Date().toISOString(),
  });

  return { ok: true as const };
}

export async function handleUpsertNotice(input: {
  secret: string;
  expectedSecret: string;
  args: { eventId: string; userId: string; reason: string };
  createUseCase: () => ExecuteUseCase<{ eventId: string; userId: string; reason: string }, { ok: true }>;
}) {
  assertInternalSecret(input.secret, input.expectedSecret);
  return await input.createUseCase().execute(input.args);
}

export async function handleSetEventResult(input: {
  secret: string;
  expectedSecret: string;
  eventId: string;
  eventResult: Record<string, unknown>;
  getEventById: (eventId: string) => Promise<Record<string, unknown> | null>;
  patchEvent: (eventId: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  assertInternalSecret(input.secret, input.expectedSecret);

  const event = await input.getEventById(input.eventId);
  if (!event) {
    throw new Error("Event not found.");
  }

  await input.patchEvent(input.eventId, {
    eventResult: input.eventResult,
    updatedAt: new Date().toISOString(),
  });

  return { ok: true as const };
}

export function handleFindNoticeTarget(input: {
  events: Array<(Record<string, unknown> & EventLike) & { _id: unknown; name: string }>;
  userId: string;
  query: string;
  now: Date;
}) {
  return findEligibleNoticeTargets({
    events: input.events.map((event) => {
      const normalized = normalizeEventRecord(event);
      return {
        id: String(event._id),
        name: event.name,
        meetingStart: normalized.meetingStart,
        status: normalized.status,
        participants: normalized.participants,
      };
    }),
    userId: input.userId,
    query: input.query,
    now: input.now,
  }).map((event) => ({
    id: event.id,
    name: event.name,
    meetingStart: event.meetingStart,
  }));
}

export async function handleApplyEventScore(input: {
  eventId: string;
  createUseCase: () => ExecuteUseCase<string, unknown>;
}) {
  return await input.createUseCase().execute(input.eventId);
}
