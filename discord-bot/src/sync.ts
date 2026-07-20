import { ChannelType, Client, TextChannel } from "discord.js";

import { getClanDiscordMessages } from "../../src/lib/clan-language";

import { ATTENDANCE_OFFSETS_HOURS } from "./constants";
import { convex, references } from "./convex";
import { env } from "./environment";
import { syncForumChannel } from "./forum";
import { logError, logInfo, logWarn } from "./log";
import {
  buildAnnouncementMessage,
  buildAttendanceReminderComponents,
  buildMembershipPanelComponents,
  buildMembershipPanelEmbed,
  buildTicketPanelComponents,
  buildTicketPanelEmbed,
} from "./message-builders";
import {
  deriveScheduledEventLifecycle,
  getStoredScheduledEventStatus,
  syncScheduledDiscordEvent,
  cancelScheduledDiscordEvent,
} from "./scheduled-events";
import type { EventRecord, SyncPayload, SyncState } from "./types";
import { buildDiscordMessageLink } from "./utils";

type PollLoopOptions = {
  client: Client;
  queuedEventIds: Set<string>;
};

export function createPollLoop(options: PollLoopOptions) {
  const { client, queuedEventIds } = options;
  let isSyncing = false;

  return async function pollLoop() {
    if (isSyncing) {
      logWarn("poll-loop", "Skipped poll because another poll is already running");
      return;
    }
    isSyncing = true;
    logInfo("poll-loop", "Poll started", { queuedEvents: queuedEventIds.size });

    try {
      await convex.mutation(references.reconcileStatuses, {
        secret: env.internalSecret,
      });
      logInfo("poll-loop", "Reconciled event statuses");

      const payloads = (await convex.query(references.listSyncPayloads, {
        secret: env.internalSecret,
      })) as SyncPayload[];
      logInfo("poll-loop", "Loaded sync payloads", { payloadCount: payloads.length });

      for (const payload of payloads) {
        await syncGuildPayload(client, queuedEventIds, payload);
      }
    } catch (error) {
      logError("poll-loop", "Discord bot sync loop failed", { error });
    } finally {
      isSyncing = false;
      logInfo("poll-loop", "Poll finished");
    }
  };
}

export async function syncGuildPayload(client: Client, queuedEventIds: Set<string>, payload: SyncPayload) {
  logInfo("guild-sync", "Syncing guild payload", {
    guildId: payload.config.guildId,
    eventCount: payload.events.length,
    rosterCount: payload.rosters.length,
    syncStateCount: payload.syncStates.length,
  });
  await runGuildSyncStep("member access sync", payload, () => syncGuildMemberAccess(client, payload));
  await runGuildSyncStep("ticket panel sync", payload, () => syncTicketPanel(client, payload));
  await runGuildSyncStep("membership panel sync", payload, () => syncMembershipPanel(client, payload));
  await runGuildSyncStep("attendance reminder sync", payload, () =>
    processAttendanceReminders(client, queuedEventIds, payload),
  );

  for (const event of payload.events) {
    const state = payload.syncStates.find((item) => item.eventId === event.id);
    const roster = payload.rosters.find((item) => item.eventId === event.id);
    const desiredScheduledEventStatus = payload.config.meetingChannelId
      ? getStoredScheduledEventStatus(deriveScheduledEventLifecycle(event))
      : undefined;

    if (event.status === "concluded" && !state && !queuedEventIds.has(event.id)) {
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

    const needsSync =
      !state ||
      state.lastEventUpdatedAt !== event.updatedAt ||
      state.lastRosterUpdatedAt !== roster?.updatedAt ||
      state.lastConfigUpdatedAt !== payload.config.updatedAt ||
      state.scheduledEventStatus !== desiredScheduledEventStatus ||
      (
        payload.config.meetingChannelId
          ? !state.scheduledEventId &&
            desiredScheduledEventStatus !== "completed" &&
            desiredScheduledEventStatus !== "canceled"
          : Boolean(state.scheduledEventId)
      ) ||
      queuedEventIds.has(event.id);

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

async function runGuildSyncStep(step: string, payload: SyncPayload, execute: () => Promise<void>) {
  try {
    await execute();
  } catch (error) {
    logError("guild-sync", `Discord bot ${step} failed`, {
      guildId: payload.config.guildId,
      error,
    });
  }
}

async function syncTicketPanel(client: Client, payload: SyncPayload) {
  const ticketSettings = payload.config.ticketSettings;
  if (!ticketSettings?.enabled || !ticketSettings.submitChannelId || !ticketSettings.ticketParentChannelId || !ticketSettings.categories.length) {
    logInfo("ticket-panel", "Skipping ticket panel sync because configuration is incomplete", {
      guildId: payload.config.guildId,
      enabled: ticketSettings?.enabled ?? false,
    });
    return;
  }

  const guild = await client.guilds.fetch(payload.config.guildId).catch(() => null);
  if (!guild) {
    logWarn("ticket-panel", "Skipping ticket panel sync because guild could not be fetched", {
      guildId: payload.config.guildId,
    });
    return;
  }

  const channel = await guild.channels.fetch(ticketSettings.submitChannelId).catch(() => null);
  if (!channel?.isTextBased() || channel.type !== ChannelType.GuildText) {
    logWarn("ticket-panel", "Skipping ticket panel sync because submit channel is unavailable or not text", {
      guildId: payload.config.guildId,
      channelId: ticketSettings.submitChannelId,
    });
    return;
  }

  const textChannel = channel as TextChannel;
  const currentMessage = payload.config.ticketPanelMessageId
    ? await textChannel.messages.fetch(payload.config.ticketPanelMessageId).catch(() => null)
    : null;
  const embed = buildTicketPanelEmbed(payload.config);
  if (!embed) {
    return;
  }
  const components = buildTicketPanelComponents(payload.config);

  let ticketPanelMessageId = payload.config.ticketPanelMessageId;

  if (currentMessage) {
    logInfo("ticket-panel", "Updating existing ticket panel message", {
      guildId: payload.config.guildId,
      messageId: currentMessage.id,
    });
    await currentMessage.edit({ embeds: [embed], components });
  } else {
    const created = await textChannel.send({ embeds: [embed], components });
    logInfo("ticket-panel", "Created ticket panel message", {
      guildId: payload.config.guildId,
      channelId: textChannel.id,
      messageId: created.id,
    });
    ticketPanelMessageId = created.id;
  }

  if (
    ticketPanelMessageId !== payload.config.ticketPanelMessageId ||
    payload.config.ticketPanelLastConfigUpdatedAt !== payload.config.updatedAt
  ) {
    await convex.mutation(references.updateTicketPanelState, {
      secret: env.internalSecret,
      guildId: payload.config.guildId,
      ticketPanelMessageId,
      ticketPanelLastConfigUpdatedAt: payload.config.updatedAt,
    });
  }
}

async function syncMembershipPanel(client: Client, payload: SyncPayload) {
  const membershipSettings = payload.config.membershipSettings;
  if (!membershipSettings?.enabled || !membershipSettings.submitChannelId || !membershipSettings.applicationParentChannelId || !membershipSettings.categories.length) {
    logInfo("membership-panel", "Skipping membership panel sync because configuration is incomplete", {
      guildId: payload.config.guildId,
      enabled: membershipSettings?.enabled ?? false,
    });
    return;
  }

  const guild = await client.guilds.fetch(payload.config.guildId).catch(() => null);
  if (!guild) {
    logWarn("membership-panel", "Skipping membership panel sync because guild could not be fetched", {
      guildId: payload.config.guildId,
    });
    return;
  }

  const channel = await guild.channels.fetch(membershipSettings.submitChannelId).catch(() => null);
  if (!channel?.isTextBased() || channel.type !== ChannelType.GuildText) {
    logWarn("membership-panel", "Skipping membership panel sync because submit channel is unavailable or not text", {
      guildId: payload.config.guildId,
      channelId: membershipSettings.submitChannelId,
    });
    return;
  }

  const textChannel = channel as TextChannel;
  const currentMessage = payload.config.membershipPanelMessageId
    ? await textChannel.messages.fetch(payload.config.membershipPanelMessageId).catch(() => null)
    : null;
  const embed = buildMembershipPanelEmbed(payload.config);
  if (!embed) {
    return;
  }
  const components = buildMembershipPanelComponents(payload.config);

  let membershipPanelMessageId = payload.config.membershipPanelMessageId;

  if (currentMessage) {
    logInfo("membership-panel", "Updating existing membership panel message", {
      guildId: payload.config.guildId,
      messageId: currentMessage.id,
    });
    await currentMessage.edit({ embeds: [embed], components });
  } else {
    const created = await textChannel.send({ embeds: [embed], components });
    logInfo("membership-panel", "Created membership panel message", {
      guildId: payload.config.guildId,
      channelId: textChannel.id,
      messageId: created.id,
    });
    membershipPanelMessageId = created.id;
  }

  if (
    membershipPanelMessageId !== payload.config.membershipPanelMessageId ||
    payload.config.membershipPanelLastConfigUpdatedAt !== payload.config.updatedAt
  ) {
    await convex.mutation(references.updateMembershipPanelState, {
      secret: env.internalSecret,
      guildId: payload.config.guildId,
      membershipPanelMessageId,
      membershipPanelLastConfigUpdatedAt: payload.config.updatedAt,
    });
  }
}

async function syncGuildMemberAccess(client: Client, payload: SyncPayload) {
  const guild = await client.guilds.fetch(payload.config.guildId).catch(() => null);
  if (!guild) {
    logWarn("member-access", "Skipping member access sync because guild could not be fetched", {
      guildId: payload.config.guildId,
    });
    return;
  }

  const members = await guild.members.fetch().catch(() => null);
  if (!members) {
    logWarn("member-access", "Skipping member access sync because members could not be fetched", {
      guildId: payload.config.guildId,
    });
    return;
  }

  logInfo("member-access", "Syncing guild member access", {
    guildId: payload.config.guildId,
    memberCount: members.size,
  });

  await convex.mutation(references.syncMemberAccess, {
    secret: env.internalSecret,
    guildId: payload.config.guildId,
    members: members.map((member) => {
      const roleIds = [...member.roles.cache.keys()].filter((roleId) => roleId !== guild.id);
      const isAdmin = member.permissions.has("Administrator");
      const hasDashboardAccess =
        isAdmin ||
        (payload.config.dashboardAdminRoleId ? roleIds.includes(payload.config.dashboardAdminRoleId) : false);

      return {
        userId: member.id,
        roleIds,
        voiceChannelId: member.voice.channelId ?? undefined,
        isAdmin,
        hasDashboardAccess,
      };
    }),
  });
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

async function processAttendanceReminders(client: Client, queuedEventIds: Set<string>, payload: SyncPayload) {
  const guild = await client.guilds.fetch(payload.config.guildId).catch(() => null);
  if (!guild) {
    logWarn("attendance-reminders", "Skipping attendance reminders because guild could not be fetched", {
      guildId: payload.config.guildId,
    });
    return;
  }

  for (const event of payload.events) {
    if (event.status !== "starting") continue;

    const roster = payload.rosters.find((item) => item.eventId === event.id && item.published);
    if (!roster) {
      logInfo("attendance-reminders", "Skipping reminders because no published roster exists", {
        eventId: event.id,
        guildId: payload.config.guildId,
      });
      continue;
    }

    const syncState = payload.syncStates.find((item) => item.eventId === event.id);
    const meetingStartMs = new Date(event.meetingStart).getTime();
    if (!Number.isFinite(meetingStartMs)) {
      logWarn("attendance-reminders", "Skipping reminders because meeting start is invalid", {
        eventId: event.id,
        guildId: payload.config.guildId,
        meetingStart: event.meetingStart,
      });
      continue;
    }

    const unacknowledgedUserIds = new Set(
      roster.squads.flatMap((squad) =>
        squad.players.filter((player) => player.id && !player.ack).map((player) => player.id!),
      ),
    );
    if (!unacknowledgedUserIds.size) {
      logInfo("attendance-reminders", "Skipping reminders because everyone already acknowledged attendance", {
        eventId: event.id,
        guildId: payload.config.guildId,
      });
      continue;
    }

    const now = Date.now();
    const remindersToLog: Array<{ userId: string; offsetHours: number; sentAt: string }> = [];

    for (const offsetHours of ATTENDANCE_OFFSETS_HOURS) {
      const triggerTime = meetingStartMs - offsetHours * 60 * 60 * 1000;
      if (now < triggerTime) continue;

      for (const userId of unacknowledgedUserIds) {
        const alreadySent = event.attendanceReminderLog.some(
          (entry) => entry.userId === userId && entry.offsetHours === offsetHours,
        );
        if (alreadySent) continue;

        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) continue;

        const sentAt = new Date().toISOString();
        const eventMessageUrl =
          buildDiscordMessageLink(
            payload.config.guildId,
            syncState?.announcementChannelId,
            syncState?.announcementMessageId,
          ) ??
          buildDiscordMessageLink(
            payload.config.guildId,
            syncState?.forumChannelId,
            syncState?.infoMessageId,
          );
        const messages = getClanDiscordMessages(payload.config.defaultLanguage);
        const message = [
          `${messages.reminders.title} **${event.name}**.`,
          messages.reminders.body,
          `${messages.reminders.meeting}: <t:${Math.floor(meetingStartMs / 1000)}:F>`,
          eventMessageUrl
            ? `${messages.reminders.eventThread}: [${messages.reminders.openInDiscord}](${eventMessageUrl})`
            : null,
        ]
          .filter((line): line is string => Boolean(line))
          .join("\n");

        try {
          await user.send({
            content: message,
            components: buildAttendanceReminderComponents(event.id, payload.config.defaultLanguage),
          });
          logInfo("attendance-reminders", "Sent attendance reminder", {
            eventId: event.id,
            guildId: payload.config.guildId,
            userId,
            offsetHours,
          });
        } catch {
          continue;
        }

        remindersToLog.push({ userId, offsetHours, sentAt });
      }
    }

    if (remindersToLog.length) {
      await convex.mutation(references.appendAttendanceReminderLog, {
        secret: env.internalSecret,
        eventId: event.id as never,
        reminders: remindersToLog,
      });
      queuedEventIds.add(event.id);
      logInfo("attendance-reminders", "Logged attendance reminders and re-queued event", {
        eventId: event.id,
        guildId: payload.config.guildId,
        reminderCount: remindersToLog.length,
      });
    }
  }
}
