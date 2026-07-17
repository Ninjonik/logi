import {
  ChannelType,
  Guild,
  GuildBasedChannel,
  GuildChannel,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventStatus,
} from "discord.js";

import type { EventRecord } from "./types";

export type ScheduledLifecycle = "scheduled" | "active" | "completed" | "canceled";

export function deriveScheduledEventLifecycle(event: EventRecord): ScheduledLifecycle {
  const now = Date.now();
  const meetingStart = new Date(event.meetingStart).getTime();
  const gameEnd = new Date(event.gameEnd).getTime();

  if (event.status === "concluded") {
    return Number.isFinite(meetingStart) && now < meetingStart ? "canceled" : "completed";
  }
  if (Number.isFinite(gameEnd) && now >= gameEnd) {
    return "completed";
  }
  if (Number.isFinite(meetingStart) && now >= meetingStart) {
    return "active";
  }

  return "scheduled";
}

export function getStoredScheduledEventStatus(status: ScheduledLifecycle) {
  return status;
}

export async function syncScheduledDiscordEvent(input: {
  guild: Guild;
  event: EventRecord;
  meetingChannel: GuildBasedChannel | null;
  scheduledEventId?: string;
  desiredLifecycle: ScheduledLifecycle;
}) {
  const { guild, event, meetingChannel, scheduledEventId, desiredLifecycle } = input;
  const isSupportedMeetingChannel =
    meetingChannel?.type === ChannelType.GuildVoice || meetingChannel?.type === ChannelType.GuildStageVoice;

  if (!isSupportedMeetingChannel) {
    if (scheduledEventId) {
      await cancelScheduledDiscordEvent(guild, scheduledEventId);
    }
    return {
      scheduledEventId: undefined,
      scheduledEventStatus: scheduledEventId ? "canceled" as const : undefined,
    };
  }

  const eventChannel = meetingChannel as GuildChannel;
  const scheduledStartTime = new Date(event.meetingStart);
  const scheduledEndTime = resolveScheduledEndTime(event);
  let scheduledEvent = scheduledEventId
    ? await guild.scheduledEvents.fetch(scheduledEventId).catch(() => null)
    : null;

  if (!scheduledEvent) {
    if (desiredLifecycle === "completed" || desiredLifecycle === "canceled") {
      return {
        scheduledEventId: undefined,
        scheduledEventStatus: desiredLifecycle,
      };
    }

    scheduledEvent = await guild.scheduledEvents.create({
      name: event.name.slice(0, 100),
      description: buildScheduledEventDescription(event),
      scheduledStartTime,
      scheduledEndTime,
      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
      entityType: GuildScheduledEventEntityType.Voice,
      channel: eventChannel.id,
    });
  } else if (
    scheduledEvent.status !== GuildScheduledEventStatus.Completed &&
    scheduledEvent.status !== GuildScheduledEventStatus.Canceled
  ) {
    await scheduledEvent.edit({
      name: event.name.slice(0, 100),
      description: buildScheduledEventDescription(event),
      scheduledStartTime,
      scheduledEndTime,
      channel: eventChannel.id,
    });
  }

  if (!scheduledEvent) {
    return {
      scheduledEventId: undefined,
      scheduledEventStatus: desiredLifecycle,
    };
  }

  if (
    desiredLifecycle !== "scheduled" &&
    scheduledEvent.status !== GuildScheduledEventStatus.Completed &&
    scheduledEvent.status !== GuildScheduledEventStatus.Canceled
  ) {
    const nextDiscordStatus =
      desiredLifecycle === "active"
        ? GuildScheduledEventStatus.Active
        : desiredLifecycle === "completed"
          ? GuildScheduledEventStatus.Completed
          : GuildScheduledEventStatus.Canceled;

    if (scheduledEvent.status !== nextDiscordStatus) {
      scheduledEvent = await scheduledEvent.edit({ status: nextDiscordStatus });
    }
  }

  return {
    scheduledEventId: scheduledEvent.id,
    scheduledEventStatus: desiredLifecycle,
  };
}

export async function cancelScheduledDiscordEvent(guild: Guild, scheduledEventId: string) {
  const scheduledEvent = await guild.scheduledEvents.fetch(scheduledEventId).catch(() => null);
  if (!scheduledEvent) {
    return false;
  }

  if (
    scheduledEvent.status !== GuildScheduledEventStatus.Completed &&
    scheduledEvent.status !== GuildScheduledEventStatus.Canceled
  ) {
    await scheduledEvent.edit({ status: GuildScheduledEventStatus.Canceled }).catch(() => null);
  }

  return true;
}

function buildScheduledEventDescription(event: EventRecord) {
  const lines = [
    event.description?.trim(),
    event.notes?.trim(),
    event.kind === "match" && event.map ? `Map: ${event.map}` : null,
    event.kind === "match" && event.side ? `Side: ${event.side}` : null,
    event.kind === "match" && event.cap ? `Cap: ${event.cap}` : null,
    event.server ? `Server: ${event.server}` : null,
    event.kind === "match" && event.serverPassword ? `Password: ${event.serverPassword}` : null,
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n").slice(0, 1000) || "Managed by Logi.";
}

function resolveScheduledEndTime(event: EventRecord) {
  const scheduledStartTime = new Date(event.meetingStart);
  const scheduledEndTime = new Date(event.gameEnd);

  if (
    Number.isFinite(scheduledStartTime.getTime()) &&
    Number.isFinite(scheduledEndTime.getTime()) &&
    scheduledEndTime.getTime() > scheduledStartTime.getTime()
  ) {
    return scheduledEndTime;
  }

  return new Date(scheduledStartTime.getTime() + 90 * 60 * 1000);
}
