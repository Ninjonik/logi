import {
  ChannelType,
  Guild,
  GuildBasedChannel,
  GuildChannel,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventStatus,
} from "discord.js";

import { getClanDiscordMessages } from "../../src/lib/clan-language";

import { logWarn } from "./log";
import type { ClanLanguage, EventRecord } from "./types";

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
  language: ClanLanguage;
  meetingChannel: GuildBasedChannel | null;
  scheduledEventId?: string;
  desiredLifecycle: ScheduledLifecycle;
}) {
  const { guild, event, language, meetingChannel, scheduledEventId, desiredLifecycle } = input;
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
      description: buildScheduledEventDescription(event, language),
      scheduledStartTime,
      scheduledEndTime,
      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
      entityType: GuildScheduledEventEntityType.Voice,
      channel: eventChannel.id,
    }).catch((error) => {
      logWarn("scheduled-events", "Failed to create scheduled Discord event", {
        guildId: guild.id,
        eventId: event.id,
        channelId: eventChannel.id,
        error,
      });
      return null;
    });
    if (!scheduledEvent) {
      return {
        scheduledEventId: undefined,
        scheduledEventStatus: scheduledEventId ? "canceled" as const : undefined,
      };
    }
  } else if (
    scheduledEvent.status !== GuildScheduledEventStatus.Completed &&
    scheduledEvent.status !== GuildScheduledEventStatus.Canceled
  ) {
    scheduledEvent = await scheduledEvent.edit({
      name: event.name.slice(0, 100),
      description: buildScheduledEventDescription(event, language),
      scheduledStartTime,
      scheduledEndTime,
      channel: eventChannel.id,
    }).catch((error) => {
      logWarn("scheduled-events", "Failed to edit scheduled Discord event", {
        guildId: guild.id,
        eventId: event.id,
        scheduledEventId: scheduledEventId ?? scheduledEvent?.id,
        error,
      });
      return scheduledEvent;
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
      scheduledEvent = await scheduledEvent.edit({ status: nextDiscordStatus }).catch((error) => {
        logWarn("scheduled-events", "Failed to advance scheduled Discord event status", {
          guildId: guild.id,
          eventId: event.id,
          scheduledEventId: scheduledEvent?.id,
          desiredLifecycle,
          error,
        });
        return scheduledEvent;
      });
    }
  }

  if (!scheduledEvent) {
    return {
      scheduledEventId: undefined,
      scheduledEventStatus: desiredLifecycle,
    };
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

function buildScheduledEventDescription(event: EventRecord, language: ClanLanguage) {
  const messages = getClanDiscordMessages(language);
  const lines = [
    event.description?.trim(),
    event.notes?.trim(),
    event.kind === "match" && event.map ? `${messages.scheduledEvent.map}: ${event.map}` : null,
    event.kind === "match" && event.side ? `${messages.scheduledEvent.side}: ${event.side}` : null,
    event.kind === "match" && event.cap ? `${messages.scheduledEvent.cap}: ${event.cap}` : null,
    event.server ? `${messages.scheduledEvent.server}: ${event.server}` : null,
    event.kind === "match" && event.serverPassword ? `${messages.scheduledEvent.password}: ${event.serverPassword}` : null,
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n").slice(0, 1000) || messages.scheduledEvent.managedFallback;
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
