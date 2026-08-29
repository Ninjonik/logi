import { ChannelType, type Client, type Guild, type TextChannel } from "discord.js";

import { convex, references } from "../convex";
import { env } from "../environment";
import { reportClanDiscordError } from "../error-reporting";
import { syncForumChannel } from "../forum";
import { syncEventRoles } from "../event-roles";
import { logError, logInfo, logWarn } from "../log";
import { buildAnnouncementMessage } from "../message-builders";
import {
  cancelScheduledDiscordEvent,
  deriveScheduledEventLifecycle,
  getStoredScheduledEventStatus,
  syncScheduledDiscordEvent,
} from "../scheduled-events";
import type { EventRecord, Roster, SyncPayload, SyncState } from "../types";
import { shouldSyncEvent, shouldWriteMinimalConcludedSyncState } from "./rules";
import { getCalendarSyncVersion } from "./work";
import { withTimeout } from "../utils";

function shouldShowPublishedRosterImage(event: EventRecord, rosterUpdatedAt?: string) {
  return Boolean(rosterUpdatedAt && (event.status === "closed" || event.status === "starting"));
}

async function resolveAnnouncementDisplayNames(payload: SyncPayload, event: EventRecord, guild: Guild) {
  const userIds = new Set<string>();

  for (const signUp of event.signUps) {
    userIds.add(signUp.userId);
  }

  for (const participant of event.participants) {
    userIds.add(participant.userId);
  }

  if (userIds.size === 0) {
    return payload.userDisplayNames;
  }

  const resolvedDisplayNames = { ...payload.userDisplayNames };
  const members = await guild.members.fetch({ user: [...userIds] }).catch(() => null);

  if (members) {
    for (const [userId, member] of members) {
      const displayName = member.displayName?.trim();
      if (displayName) {
        resolvedDisplayNames[userId] = displayName;
      }
    }
  }

  return resolvedDisplayNames;
}

async function syncEventMessage(channel: TextChannel, messageId: string | undefined, payload: SyncPayload, event: EventRecord, roster: Roster | undefined, guild: Guild, includeSignup = true) {
  const existing = messageId ? await channel.messages.fetch(messageId).catch(() => null) : null;
  if (event.status === "concluded") {
    await existing?.delete().catch(() => null);
    return undefined;
  }
  const displayEvent = !includeSignup && !roster?.published ? { ...event, participants: [], signUps: [] } : event;
  const displayPayload = displayEvent === event ? payload : { ...payload, events: payload.events.map((item) => item.id === event.id ? displayEvent : item) };
  const names = await resolveAnnouncementDisplayNames(displayPayload, displayEvent, guild);
  const { embed, components } = buildAnnouncementMessage(displayPayload, displayEvent, names, { showPublishedRosterImage: !includeSignup });
  const messageComponents = includeSignup ? components : [];
  if (existing) {
    if (shouldShowPublishedRosterImage(event, roster?.updatedAt) && existing.embeds.length) await existing.delete().catch(() => null);
    else { await existing.edit({ embeds: [embed], components: messageComponents }); return existing.id; }
  }
  return (await channel.send({ embeds: [embed], components: messageComponents })).id;
}

async function recoverEventMessageId(channel: TextChannel, messageId: string | undefined, event: EventRecord, botUserId?: string) {
  const stored = messageId ? await channel.messages.fetch(messageId).catch(() => null) : null;
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  const matches = messages
    ? [...messages.values()]
      .filter((message) =>
        (!botUserId || message.author.id === botUserId) &&
        message.embeds.some((embed) => embed.title?.includes(event.name)),
      )
      .sort((left, right) => right.createdTimestamp - left.createdTimestamp)
    : [];
  const primary = stored ?? matches[0];
  const duplicates = matches.filter((message) => message.id !== primary?.id);
  await Promise.all(duplicates.map((message) => message.delete().catch(() => null)));
  return primary?.id;
}

export async function syncPayloadEvents(
  client: Client,
  queuedEventIds: Set<string>,
  payload: SyncPayload,
  options: { syncRoles: boolean } = { syncRoles: true },
) {
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
        eventInfoMessageId: undefined,
        eventInfoMessageRenderVersion: undefined,
        scheduledEventId: undefined,
        scheduledEventStatus: desiredScheduledEventStatus,
        forumChannelId: undefined,
        forumThreadId: undefined,
        infoMessageId: undefined,
        topicMessageIds: [],
        lastEventUpdatedAt: event.updatedAt,
        lastRosterUpdatedAt: roster?.updatedAt,
        lastConfigUpdatedAt: payload.config.updatedAt,
        lastCalendarSyncVersion: getCalendarSyncVersion(event),
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
      eventInfoChannelConfigured: event.kind === "match" && Boolean(payload.config.announcementsChannelId && payload.config.eventInfoChannelId),
      eventInfoMessageRequired: event.kind === "match" && Boolean(payload.config.announcementsChannelId && payload.config.eventInfoChannelId),
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
      await withTimeout(syncEvent(client, payload, event, state, options), 20_000, `event sync ${event.id}`);
    } catch (error) {
      logError("event-sync", "Discord bot event sync failed", {
        eventId: event.id,
        guildId: payload.config.guildId,
        error,
      });
      await reportClanDiscordError({
        client,
        guildId: payload.config.guildId,
        error,
        action: `Sync event "${event.name}"`,
        location: "Event sync",
        scope: "event-sync",
        target: event.name,
        details: {
          eventId: event.id,
          status: event.status,
        },
      });
    }
  }
}

async function syncEvent(
  client: Client,
  payload: SyncPayload,
  event: EventRecord,
  state?: SyncState,
  options: { syncRoles: boolean } = { syncRoles: true },
) {
  const guild = await client.guilds.fetch(payload.config.guildId).catch(() => null);
  if (!guild) {
    logWarn("event-sync", "Skipping event sync because guild could not be fetched", {
      eventId: event.id,
      guildId: payload.config.guildId,
    });
    return;
  }

  const roster = payload.rosters.find((item) => item.eventId === event.id);
  const eventRoles = options.syncRoles
    ? await syncEventRoles(guild, event, roster ?? null)
    : { attendeeRoleId: event.attendeeRoleId, reserveRoleId: event.reserveRoleId };
  let announcementMessageId = state?.announcementMessageId;
  let eventInfoMessageId = state?.eventInfoMessageId;
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
    eventInfoChannelId: payload.config.eventInfoChannelId,
    meetingChannelId: payload.config.meetingChannelId,
    forumCategoryId: payload.config.forumCategoryId,
    createForumChannel: event.createForumChannel,
  });

  const splitChannels = event.kind === "match" && Boolean(payload.config.announcementsChannelId && payload.config.eventInfoChannelId);
  logInfo("event-sync", "Resolved event message channels", {
    eventId: event.id,
    eventKind: event.kind,
    registrationChannelId: payload.config.announcementsChannelId,
    eventInfoChannelId: payload.config.eventInfoChannelId,
    splitChannels,
    rosterPublished: Boolean(roster?.published),
  });
  const registrationChannel = payload.config.announcementsChannelId ? await guild.channels.fetch(payload.config.announcementsChannelId).catch(() => null) : null;
  const infoChannel = splitChannels && payload.config.eventInfoChannelId ? await guild.channels.fetch(payload.config.eventInfoChannelId).catch(() => null) : null;
  if (splitChannels && registrationChannel?.isTextBased() && infoChannel?.isTextBased() && registrationChannel.type !== ChannelType.GuildVoice && infoChannel.type !== ChannelType.GuildVoice) {
    const registrationText = registrationChannel as TextChannel;
    const infoText = infoChannel as TextChannel;
    eventInfoMessageId = await recoverEventMessageId(infoText, eventInfoMessageId, event, guild.client.user?.id);
    eventInfoMessageId = await syncEventMessage(infoText, eventInfoMessageId, payload, event, roster, guild, false);
    logInfo("event-sync", "Synchronized event info message", {
      eventId: event.id,
      guildId: payload.config.guildId,
      messageId: eventInfoMessageId,
      rosterImageAttached: Boolean(event.kind === "match" && roster?.published),
    });
    announcementMessageId = await recoverEventMessageId(registrationText, announcementMessageId, event, guild.client.user?.id);
    if (event.status === "registration") {
      announcementMessageId = await syncEventMessage(registrationText, announcementMessageId, payload, event, roster, guild);
    } else {
      const registrationMessage = announcementMessageId ? await registrationText.messages.fetch(announcementMessageId).catch(() => null) : null;
      await registrationMessage?.delete().catch(() => null);
      announcementMessageId = undefined;
    }
  }
  const shouldUseEventInfoChannel = false;
  const displayChannelId = splitChannels ? undefined : payload.config.announcementsChannelId;
  if (displayChannelId && !(event.status === "concluded" && !announcementMessageId)) {
    const channel = await guild.channels.fetch(displayChannelId).catch(() => null);
    if (
      channel?.isTextBased() &&
      (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)
    ) {
      const textChannel = channel as TextChannel;
      const userDisplayNames = await resolveAnnouncementDisplayNames(payload, event, guild);
      const { embed, components } = buildAnnouncementMessage(payload, event, userDisplayNames);
      const previousChannel = state?.announcementChannelId && state.announcementChannelId !== textChannel.id
        ? await guild.channels.fetch(state.announcementChannelId).catch(() => null)
        : null;
      const existingMessage = announcementMessageId && state?.announcementChannelId === textChannel.id
        ? await textChannel.messages.fetch(announcementMessageId).catch(() => null)
        : null;
      if (previousChannel?.isTextBased() && announcementMessageId) await previousChannel.messages.fetch(announcementMessageId).then((message) => message.delete()).catch(() => null);
      const shouldRecreateAnnouncementForRosterImage =
        Boolean(existingMessage) &&
        shouldShowPublishedRosterImage(event, roster?.updatedAt) &&
        state?.lastRosterUpdatedAt !== roster?.updatedAt;

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
      } else if (existingMessage && shouldRecreateAnnouncementForRosterImage) {
        await existingMessage.delete().catch(() => null);
        const created = await textChannel.send({ embeds: [embed], components });
        announcementMessageId = created.id;
        logInfo("announcement", "Recreated event announcement for roster image refresh", {
          eventId: event.id,
          guildId: payload.config.guildId,
          channelId: textChannel.id,
          previousMessageId: existingMessage.id,
          messageId: created.id,
          previousRosterUpdatedAt: state?.lastRosterUpdatedAt,
          rosterUpdatedAt: roster?.updatedAt,
        });
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
        attendeeRoleId: eventRoles.attendeeRoleId,
        reserveRoleId: eventRoles.reserveRoleId,
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
    announcementChannelId: displayChannelId,
    announcementMessageId,
    eventInfoMessageId,
    eventInfoMessageRenderVersion: "3",
    scheduledEventId,
    scheduledEventStatus,
    forumChannelId,
    forumThreadId,
    infoMessageId,
    topicMessageIds,
    lastEventUpdatedAt: event.updatedAt,
    lastRosterUpdatedAt: roster?.updatedAt,
    lastConfigUpdatedAt: payload.config.updatedAt,
    lastCalendarSyncVersion: getCalendarSyncVersion(event),
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
