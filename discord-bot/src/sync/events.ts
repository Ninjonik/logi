import { ChannelType, type Client, type TextChannel } from "discord.js";

import { convex, references } from "../convex";
import { env } from "../environment";
import { syncForumChannel } from "../forum";
import { logError, logInfo, logWarn } from "../log";
import { buildAnnouncementMessage } from "../message-builders";
import {
  cancelScheduledDiscordEvent,
  deriveScheduledEventLifecycle,
  getStoredScheduledEventStatus,
  syncScheduledDiscordEvent,
} from "../scheduled-events";
import type { EventRecord, SyncPayload, SyncState } from "../types";
import { shouldSyncEvent, shouldWriteMinimalConcludedSyncState } from "./rules";

export async function syncPayloadEvents(client: Client, queuedEventIds: Set<string>, payload: SyncPayload) {
  for (const event of payload.events) {
    const state = payload.syncStates.find((item) => item.eventId === event.id);
    const roster = payload.rosters.find((item) => item.eventId === event.id);
    const desiredScheduledEventStatus = payload.config.meetingChannelId
      ? getStoredScheduledEventStatus(deriveScheduledEventLifecycle(event))
      : undefined;
    const queued = queuedEventIds.has(event.id);

    if (shouldWriteMinimalConcludedSyncState({ event, state, queued })) {
      logInfo("event-sync", "Writing minimal sync state for concluded event without prior state", {
        eventId: event.id,
        guildId: payload.config.guildId,
      });
      await convex.mutation(references.updateEventSyncState, {
        secret: env.internalSecret,
        eventId: event.id as never,
        guildId: payload.config.guildId,
        announcementChannelId: payload.config.announcementsChannelId,
        announcementMessageId: undefined,
        scheduledEventId: undefined,
        scheduledEventStatus: desiredScheduledEventStatus,
        forumChannelId: undefined,
        forumThreadId: undefined,
        infoMessageId: undefined,
        topicMessageIds: [],
        lastEventUpdatedAt: event.updatedAt,
        lastRosterUpdatedAt: roster?.updatedAt,
        lastConfigUpdatedAt: payload.config.updatedAt,
        lastSyncedAt: new Date().toISOString(),
      });
      continue;
    }

    const needsSync = shouldSyncEvent({
      event,
      rosterUpdatedAt: roster?.updatedAt,
      configUpdatedAt: payload.config.updatedAt,
      state,
      desiredScheduledEventStatus,
      meetingChannelConfigured: Boolean(payload.config.meetingChannelId),
      queued,
    });

    if (!needsSync) {
      logInfo("event-sync", "Skipping event because no sync changes were detected", {
        eventId: event.id,
        guildId: payload.config.guildId,
        status: event.status,
      });
      continue;
    }

    try {
      logInfo("event-sync", "Syncing event", {
        eventId: event.id,
        guildId: payload.config.guildId,
        status: event.status,
        hasState: Boolean(state),
        hasRoster: Boolean(roster),
      });
      await syncEvent(client, payload, event, state);
    } catch (error) {
      logError("event-sync", "Discord bot event sync failed", {
        eventId: event.id,
        guildId: payload.config.guildId,
        error,
      });
    }
  }
}

async function syncEvent(client: Client, payload: SyncPayload, event: EventRecord, state?: SyncState) {
  const guild = await client.guilds.fetch(payload.config.guildId).catch(() => null);
  if (!guild) {
    logWarn("event-sync", "Skipping event sync because guild could not be fetched", {
      eventId: event.id,
      guildId: payload.config.guildId,
    });
    return;
  }

  const roster = payload.rosters.find((item) => item.eventId === event.id);
  let announcementMessageId = state?.announcementMessageId;
  let scheduledEventId = state?.scheduledEventId;
  let scheduledEventStatus = state?.scheduledEventStatus;
  let forumChannelId = state?.forumChannelId;
  const forumThreadId = state?.forumThreadId;
  let infoMessageId = state?.infoMessageId;
  let topicMessageIds = state?.topicMessageIds ?? [];

  logInfo("event-sync", "Event sync started", {
    eventId: event.id,
    guildId: payload.config.guildId,
    eventStatus: event.status,
    announcementChannelId: payload.config.announcementsChannelId,
    meetingChannelId: payload.config.meetingChannelId,
    forumCategoryId: payload.config.forumCategoryId,
    createForumChannel: event.createForumChannel,
  });

  if (payload.config.announcementsChannelId && !(event.status === "concluded" && !announcementMessageId)) {
    const channel = await guild.channels.fetch(payload.config.announcementsChannelId).catch(() => null);
    if (channel?.isTextBased() && channel.type === ChannelType.GuildText) {
      const textChannel = channel as TextChannel;
      const { embed, components } = buildAnnouncementMessage(payload, event);
      const existingMessage = announcementMessageId
        ? await textChannel.messages.fetch(announcementMessageId).catch(() => null)
        : null;

      if (event.status === "concluded") {
        if (existingMessage) {
          await existingMessage.delete().catch(() => null);
          logInfo("announcement", "Deleted event announcement for concluded event", {
            eventId: event.id,
            guildId: payload.config.guildId,
            messageId: existingMessage.id,
          });
          announcementMessageId = undefined;
        }
      } else if (existingMessage) {
        await existingMessage.edit({ embeds: [embed], components });
        logInfo("announcement", "Updated event announcement", {
          eventId: event.id,
          guildId: payload.config.guildId,
          channelId: textChannel.id,
          messageId: existingMessage.id,
        });
      } else {
        const created = await textChannel.send({ embeds: [embed], components });
        announcementMessageId = created.id;
        logInfo("announcement", "Created event announcement", {
          eventId: event.id,
          guildId: payload.config.guildId,
          channelId: textChannel.id,
          messageId: created.id,
        });
      }
    } else {
      logWarn("announcement", "Announcement channel is unavailable or not a text channel", {
        eventId: event.id,
        guildId: payload.config.guildId,
        channelId: payload.config.announcementsChannelId,
      });
    }
  } else {
    logInfo("announcement", "Skipping announcement sync", {
      eventId: event.id,
      guildId: payload.config.guildId,
      reason: payload.config.announcementsChannelId
        ? "concluded-without-existing-message"
        : "announcements-channel-not-configured",
    });
  }

  const scheduledLifecycle = deriveScheduledEventLifecycle(event);
  if (payload.config.meetingChannelId) {
    try {
      const meetingChannel = await guild.channels.fetch(payload.config.meetingChannelId).catch(() => null);
      const scheduledSyncResult = await syncScheduledDiscordEvent({
        guild,
        event,
        language: payload.config.defaultLanguage,
        meetingChannel,
        scheduledEventId,
        desiredLifecycle: scheduledLifecycle,
      });

      scheduledEventId = scheduledSyncResult.scheduledEventId;
      scheduledEventStatus = scheduledSyncResult.scheduledEventStatus;
      logInfo("scheduled-event", "Scheduled event sync completed", {
        eventId: event.id,
        guildId: payload.config.guildId,
        scheduledEventId,
        scheduledEventStatus,
        desiredLifecycle: scheduledLifecycle,
      });
    } catch (error) {
      logError("scheduled-event", "Discord bot scheduled event sync failed", {
        eventId: event.id,
        guildId: payload.config.guildId,
        scheduledEventId,
        error,
      });
    }
  } else if (scheduledEventId) {
    const canceled = await cancelScheduledDiscordEvent(guild, scheduledEventId);
    scheduledEventId = undefined;
    scheduledEventStatus = canceled ? "canceled" : undefined;
    logInfo("scheduled-event", "Canceled scheduled event because meeting channel is no longer configured", {
      eventId: event.id,
      guildId: payload.config.guildId,
      canceled,
    });
  } else {
    logInfo("scheduled-event", "Skipping scheduled event sync because meeting channel is not configured", {
      eventId: event.id,
      guildId: payload.config.guildId,
    });
  }

  if (
    event.createForumChannel &&
    payload.config.forumCategoryId &&
    !(event.status === "concluded" && !forumChannelId)
  ) {
    try {
      const topicPreset = payload.topicPresets.find((preset) => preset.id === event.topicPresetId);
      const forumSyncResult = await syncForumChannel({
        config: payload.config,
        event,
        forumCategoryId: payload.config.forumCategoryId,
        forumChannelId,
        guild,
        existingTopicMessageIds: topicMessageIds,
        topicPreset,
      });

      forumChannelId = forumSyncResult.forumChannelId;
      infoMessageId = forumSyncResult.infoMessageId;
      if (!topicMessageIds.length && forumSyncResult.topicMessageIds.length) {
        topicMessageIds = forumSyncResult.topicMessageIds;
      }
      logInfo("forum", "Forum sync completed", {
        eventId: event.id,
        guildId: payload.config.guildId,
        forumChannelId,
        infoMessageId,
        topicMessageCount: topicMessageIds.length,
      });
    } catch (error) {
      logError("forum", "Discord bot forum sync failed", {
        eventId: event.id,
        guildId: payload.config.guildId,
        forumChannelId,
        error,
      });
    }
  } else {
    logInfo("forum", "Skipping forum sync", {
      eventId: event.id,
      guildId: payload.config.guildId,
      reason: !event.createForumChannel
        ? "event-forum-creation-disabled"
        : !payload.config.forumCategoryId
          ? "forum-category-not-configured"
          : "concluded-without-existing-forum",
    });
  }

  await convex.mutation(references.updateEventSyncState, {
    secret: env.internalSecret,
    eventId: event.id as never,
    guildId: payload.config.guildId,
    announcementChannelId: payload.config.announcementsChannelId,
    announcementMessageId,
    scheduledEventId,
    scheduledEventStatus,
    forumChannelId,
    forumThreadId,
    infoMessageId,
    topicMessageIds,
    lastEventUpdatedAt: event.updatedAt,
    lastRosterUpdatedAt: roster?.updatedAt,
    lastConfigUpdatedAt: payload.config.updatedAt,
    lastSyncedAt: new Date().toISOString(),
  });
  logInfo("event-sync", "Persisted event sync state", {
    eventId: event.id,
    guildId: payload.config.guildId,
    announcementMessageId,
    scheduledEventId,
    scheduledEventStatus,
    forumChannelId,
    infoMessageId,
    topicMessageCount: topicMessageIds.length,
  });
}
