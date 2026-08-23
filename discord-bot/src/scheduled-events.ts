import {
  ChannelType,
  DiscordAPIError,
  Guild,
  GuildBasedChannel,
  GuildChannel,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventStatus,
} from "discord.js";

import {
  buildScheduledEventDescription,
  resolveScheduledEventEndTime,
} from "../../src/application/discord-sync/scheduled-event-content";
import { deriveScheduledEventLifecycle } from "../../src/domain/discord-sync/rules";

import { reportClanDiscordError } from "./error-reporting";
import { logWarn } from "./log";
import type { ClanLanguage, EventRecord } from "./types";

export type ScheduledLifecycle = "scheduled" | "active" | "completed" | "canceled";
export { deriveScheduledEventLifecycle };

export function getStoredScheduledEventStatus(status: ScheduledLifecycle) {
  return status;
}

function getDiscordErrorDetails(error: unknown) {
  if (error instanceof DiscordAPIError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status,
      method: "method" in error ? (error as { method?: unknown }).method : undefined,
      url: "url" in error ? (error as { url?: unknown }).url : undefined,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown Discord error.",
  };
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
  const scheduledEndTime = resolveScheduledEventEndTime(event);
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
      const discordError = getDiscordErrorDetails(error);
      logWarn("scheduled-events", "Failed to create scheduled Discord event", {
        guildId: guild.id,
        eventId: event.id,
        channelId: eventChannel.id,
        operation: "create",
        scheduledEventName: event.name,
        desiredLifecycle,
        ...discordError,
      });
      void reportClanDiscordError({
        client: guild.client,
        guildId: guild.id,
        error,
        action: `Create the scheduled event for "${event.name}"`,
        location: "Scheduled events",
        scope: "scheduled-events",
        target: event.name,
        details: {
          eventId: event.id,
          channelId: eventChannel.id,
        },
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
      const discordError = getDiscordErrorDetails(error);
      logWarn("scheduled-events", "Failed to edit scheduled Discord event", {
        guildId: guild.id,
        eventId: event.id,
        scheduledEventId: scheduledEventId ?? scheduledEvent?.id,
        channelId: eventChannel.id,
        operation: "edit-metadata",
        scheduledEventName: event.name,
        desiredLifecycle,
        ...discordError,
      });
      void reportClanDiscordError({
        client: guild.client,
        guildId: guild.id,
        error,
        action: `Update the scheduled event for "${event.name}"`,
        location: "Scheduled events",
        scope: "scheduled-events",
        target: event.name,
        details: {
          eventId: event.id,
          scheduledEventId: scheduledEventId ?? scheduledEvent?.id,
        },
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
      const currentStatus = scheduledEvent.status;
      scheduledEvent = await scheduledEvent.edit({ status: nextDiscordStatus }).catch((error) => {
        const discordError = getDiscordErrorDetails(error);
        logWarn("scheduled-events", "Failed to advance scheduled Discord event status", {
          guildId: guild.id,
          eventId: event.id,
          scheduledEventId: scheduledEvent?.id,
          desiredLifecycle,
          operation: "edit-status",
          scheduledEventName: event.name,
          fromStatus: currentStatus,
          toStatus: nextDiscordStatus,
          ...discordError,
        });
        void reportClanDiscordError({
          client: guild.client,
          guildId: guild.id,
          error,
          action: `Change scheduled event status for "${event.name}"`,
          location: "Scheduled events",
          scope: "scheduled-events",
          target: event.name,
          details: {
            eventId: event.id,
            scheduledEventId: scheduledEvent?.id,
            desiredLifecycle,
          },
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
    await scheduledEvent.edit({ status: GuildScheduledEventStatus.Canceled }).catch((error) => {
      void reportClanDiscordError({
        client: guild.client,
        guildId: guild.id,
        error,
        action: "Cancel a scheduled event",
        location: "Scheduled events",
        scope: "scheduled-events",
        target: scheduledEvent.name,
        details: {
          scheduledEventId,
        },
      });
      return null;
    });
  }

  return true;
}
