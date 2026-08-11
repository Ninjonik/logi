import { ChannelType, type Client, type TextChannel } from "discord.js";

import { revalidateAppData } from "../cache";
import { convex, references } from "../convex";
import { env } from "../environment";
import { reportClanDiscordError } from "../error-reporting";
import { logInfo, logWarn } from "../log";
import {
  buildCalendarPanelEmbed,
  buildMembershipPanelComponents,
  buildMembershipPanelEmbed,
  buildTicketPanelComponents,
  buildTicketPanelEmbed,
} from "../message-builders";
import type { SyncPayload } from "../types";

export async function syncTicketPanel(client: Client, payload: SyncPayload) {
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
    await currentMessage.edit({ embeds: [embed], components }).catch(async (error) => {
      await reportClanDiscordError({
        client,
        guildId: payload.config.guildId,
        error,
        action: "Update the ticket panel message",
        location: "Ticket panel",
        scope: "ticket-panel",
        target: textChannel.name,
        details: {
          channelId: textChannel.id,
          messageId: currentMessage.id,
        },
      });
      throw error;
    });
  } else {
    const created = await textChannel.send({ embeds: [embed], components }).catch(async (error) => {
      await reportClanDiscordError({
        client,
        guildId: payload.config.guildId,
        error,
        action: "Create the ticket panel message",
        location: "Ticket panel",
        scope: "ticket-panel",
        target: textChannel.name,
        details: {
          channelId: textChannel.id,
        },
      });
      throw error;
    });
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
    await revalidateAppData({
      type: "discord-config-changed",
      serverId: payload.config.guildId,
    });
  }
}

export async function syncMembershipPanel(client: Client, payload: SyncPayload) {
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
    await currentMessage.edit({ embeds: [embed], components }).catch(async (error) => {
      await reportClanDiscordError({
        client,
        guildId: payload.config.guildId,
        error,
        action: "Update the membership panel message",
        location: "Membership panel",
        scope: "membership-panel",
        target: textChannel.name,
        details: {
          channelId: textChannel.id,
          messageId: currentMessage.id,
        },
      });
      throw error;
    });
  } else {
    const created = await textChannel.send({ embeds: [embed], components }).catch(async (error) => {
      await reportClanDiscordError({
        client,
        guildId: payload.config.guildId,
        error,
        action: "Create the membership panel message",
        location: "Membership panel",
        scope: "membership-panel",
        target: textChannel.name,
        details: {
          channelId: textChannel.id,
        },
      });
      throw error;
    });
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
    await revalidateAppData({
      type: "discord-config-changed",
      serverId: payload.config.guildId,
    });
  }
}

export async function syncCalendarPanel(client: Client, payload: SyncPayload) {
  const guild = await client.guilds.fetch(payload.config.guildId).catch(() => null);
  if (!guild) {
    logWarn("calendar-panel", "Skipping calendar panel sync because guild could not be fetched", {
      guildId: payload.config.guildId,
    });
    return;
  }

  const storedChannelId = payload.config.calendarMessageChannelId;
  const storedMessageId = payload.config.calendarMessageId;

  if (!payload.config.calendarChannelId) {
    if (storedChannelId && storedMessageId) {
      const previousChannel = await guild.channels.fetch(storedChannelId).catch(() => null);
      if (previousChannel?.isTextBased() && previousChannel.type === ChannelType.GuildText) {
        await (previousChannel as TextChannel).messages.fetch(storedMessageId).then((message) => message.delete()).catch((error) => {
          void reportClanDiscordError({
            client,
            guildId: payload.config.guildId,
            error,
            action: "Delete the old calendar panel message",
            location: "Calendar panel",
            scope: "calendar-panel",
            target: previousChannel.name,
            details: {
              channelId: previousChannel.id,
              messageId: storedMessageId,
            },
          });
          return null;
        });
      }
      await convex.mutation(references.updateCalendarPanelState, {
        secret: env.internalSecret,
        guildId: payload.config.guildId,
        calendarMessageChannelId: undefined,
        calendarMessageId: undefined,
        calendarMessageLastConfigUpdatedAt: payload.config.updatedAt,
      });
      await revalidateAppData({
        type: "discord-config-changed",
        serverId: payload.config.guildId,
      });
    }
    logInfo("calendar-panel", "Skipping calendar panel sync because calendar channel is not configured", {
      guildId: payload.config.guildId,
    });
    return;
  }

  const channel = await guild.channels.fetch(payload.config.calendarChannelId).catch(() => null);
  if (!channel?.isTextBased() || channel.type !== ChannelType.GuildText) {
    logWarn("calendar-panel", "Skipping calendar panel sync because calendar channel is unavailable or not text", {
      guildId: payload.config.guildId,
      channelId: payload.config.calendarChannelId,
    });
    return;
  }

  const textChannel = channel as TextChannel;

  if (storedChannelId && storedChannelId !== textChannel.id && storedMessageId) {
    const previousChannel = await guild.channels.fetch(storedChannelId).catch(() => null);
    if (previousChannel?.isTextBased() && previousChannel.type === ChannelType.GuildText) {
      await (previousChannel as TextChannel).messages.fetch(storedMessageId).then((message) => message.delete()).catch((error) => {
        void reportClanDiscordError({
          client,
          guildId: payload.config.guildId,
          error,
          action: "Delete the previous calendar panel message",
          location: "Calendar panel",
          scope: "calendar-panel",
          target: previousChannel.name,
          details: {
            channelId: previousChannel.id,
            messageId: storedMessageId,
          },
        });
        return null;
      });
    }
  }

  const currentMessage = storedMessageId && storedChannelId === textChannel.id
    ? await textChannel.messages.fetch(storedMessageId).catch(() => null)
    : null;
  const embed = buildCalendarPanelEmbed(
    payload.config,
    payload.guild.eventCategories,
    payload.events,
    payload.calendarItems,
  );

  let calendarMessageId = storedMessageId;
  if (currentMessage) {
    await currentMessage.edit({ embeds: [embed], components: [] }).catch(async (error) => {
      await reportClanDiscordError({
        client,
        guildId: payload.config.guildId,
        error,
        action: "Update the calendar panel message",
        location: "Calendar panel",
        scope: "calendar-panel",
        target: textChannel.name,
        details: {
          channelId: textChannel.id,
          messageId: currentMessage.id,
        },
      });
      throw error;
    });
    logInfo("calendar-panel", "Updated existing calendar panel message", {
      guildId: payload.config.guildId,
      messageId: currentMessage.id,
    });
  } else {
    const created = await textChannel.send({ embeds: [embed] }).catch(async (error) => {
      await reportClanDiscordError({
        client,
        guildId: payload.config.guildId,
        error,
        action: "Create the calendar panel message",
        location: "Calendar panel",
        scope: "calendar-panel",
        target: textChannel.name,
        details: {
          channelId: textChannel.id,
        },
      });
      throw error;
    });
    calendarMessageId = created.id;
    logInfo("calendar-panel", "Created calendar panel message", {
      guildId: payload.config.guildId,
      channelId: textChannel.id,
      messageId: created.id,
    });
  }

  if (
    calendarMessageId !== payload.config.calendarMessageId ||
    textChannel.id !== payload.config.calendarMessageChannelId ||
    payload.config.calendarMessageLastConfigUpdatedAt !== payload.config.updatedAt
  ) {
    await convex.mutation(references.updateCalendarPanelState, {
      secret: env.internalSecret,
      guildId: payload.config.guildId,
      calendarMessageChannelId: textChannel.id,
      calendarMessageId,
      calendarMessageLastConfigUpdatedAt: payload.config.updatedAt,
    });
    await revalidateAppData({
      type: "discord-config-changed",
      serverId: payload.config.guildId,
    });
  }
}
