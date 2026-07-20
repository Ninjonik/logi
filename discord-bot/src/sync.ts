import { ChannelType, Client, TextChannel } from "discord.js";

import { getClanDiscordMessages } from "../../src/lib/clan-language";

import { ATTENDANCE_OFFSETS_HOURS } from "./constants";
import { convex, references } from "./convex";
import { env } from "./environment";
import { syncForumChannel } from "./forum";
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
    if (isSyncing) return;
    isSyncing = true;

    try {
      await convex.mutation(references.reconcileStatuses, {
        secret: env.internalSecret,
      });

      const payloads = (await convex.query(references.listSyncPayloads, {
        secret: env.internalSecret,
      })) as SyncPayload[];

      for (const payload of payloads) {
        await syncGuildPayload(client, queuedEventIds, payload);
      }
    } catch (error) {
      console.error("Discord bot sync loop failed", error);
    } finally {
      isSyncing = false;
    }
  };
}

export async function syncGuildPayload(client: Client, queuedEventIds: Set<string>, payload: SyncPayload) {
  await syncGuildMemberAccess(client, payload);
  await syncTicketPanel(client, payload);
  await syncMembershipPanel(client, payload);
  await processAttendanceReminders(client, queuedEventIds, payload);

  for (const event of payload.events) {
    const state = payload.syncStates.find((item) => item.eventId === event.id);
    const roster = payload.rosters.find((item) => item.eventId === event.id);
    const desiredScheduledEventStatus = payload.config.meetingChannelId
      ? getStoredScheduledEventStatus(deriveScheduledEventLifecycle(event))
      : undefined;

    if (event.status === "concluded" && !state && !queuedEventIds.has(event.id)) {
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

    if (!needsSync) continue;

    try {
      await syncEvent(client, payload, event, state);
      queuedEventIds.delete(event.id);
    } catch (error) {
      console.error("Discord bot event sync failed", {
        eventId: event.id,
        guildId: payload.config.guildId,
        error,
      });
    }
  }
}

async function syncTicketPanel(client: Client, payload: SyncPayload) {
  const ticketSettings = payload.config.ticketSettings;
  if (!ticketSettings?.enabled || !ticketSettings.submitChannelId || !ticketSettings.ticketParentChannelId || !ticketSettings.categories.length) {
    return;
  }

  const guild = await client.guilds.fetch(payload.config.guildId).catch(() => null);
  if (!guild) return;

  const channel = await guild.channels.fetch(ticketSettings.submitChannelId).catch(() => null);
  if (!channel?.isTextBased() || channel.type !== ChannelType.GuildText) {
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
    await currentMessage.edit({ embeds: [embed], components });
  } else {
    const created = await textChannel.send({ embeds: [embed], components });
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
    return;
  }

  const guild = await client.guilds.fetch(payload.config.guildId).catch(() => null);
  if (!guild) return;

  const channel = await guild.channels.fetch(membershipSettings.submitChannelId).catch(() => null);
  if (!channel?.isTextBased() || channel.type !== ChannelType.GuildText) {
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
    await currentMessage.edit({ embeds: [embed], components });
  } else {
    const created = await textChannel.send({ embeds: [embed], components });
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
  if (!guild) return;

  const members = await guild.members.fetch().catch(() => null);
  if (!members) return;

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
  if (!guild) return;

  const roster = payload.rosters.find((item) => item.eventId === event.id);
  let announcementMessageId = state?.announcementMessageId;
  let scheduledEventId = state?.scheduledEventId;
  let scheduledEventStatus = state?.scheduledEventStatus;
  let forumChannelId = state?.forumChannelId;
  const forumThreadId = state?.forumThreadId;
  let infoMessageId = state?.infoMessageId;
  let topicMessageIds = state?.topicMessageIds ?? [];

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
          announcementMessageId = undefined;
        }
      } else if (existingMessage) {
        await existingMessage.edit({ embeds: [embed], components });
      } else {
        const created = await textChannel.send({ embeds: [embed], components });
        announcementMessageId = created.id;
      }
    }
  }

  const scheduledLifecycle = deriveScheduledEventLifecycle(event);
  if (payload.config.meetingChannelId) {
    try {
      const meetingChannel = await guild.channels.fetch(payload.config.meetingChannelId).catch(() => null);
      const scheduledSyncResult = await syncScheduledDiscordEvent({
        guild,
        event,
        meetingChannel,
        scheduledEventId,
        desiredLifecycle: scheduledLifecycle,
      });

      scheduledEventId = scheduledSyncResult.scheduledEventId;
      scheduledEventStatus = scheduledSyncResult.scheduledEventStatus;
    } catch (error) {
      console.error("Discord bot scheduled event sync failed", {
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
    } catch (error) {
      console.error("Discord bot forum sync failed", {
        eventId: event.id,
        guildId: payload.config.guildId,
        forumChannelId,
        error,
      });
    }
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
}

async function processAttendanceReminders(client: Client, queuedEventIds: Set<string>, payload: SyncPayload) {
  const guild = await client.guilds.fetch(payload.config.guildId).catch(() => null);
  if (!guild) return;

  for (const event of payload.events) {
    if (event.status !== "starting") continue;

    const roster = payload.rosters.find((item) => item.eventId === event.id && item.published);
    if (!roster) continue;

    const syncState = payload.syncStates.find((item) => item.eventId === event.id);
    const meetingStartMs = new Date(event.meetingStart).getTime();
    if (!Number.isFinite(meetingStartMs)) continue;

    const unacknowledgedUserIds = new Set(
      roster.squads.flatMap((squad) =>
        squad.players.filter((player) => player.id && !player.ack).map((player) => player.id!),
      ),
    );
    if (!unacknowledgedUserIds.size) continue;

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
    }
  }
}
