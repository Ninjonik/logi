import { ChannelType, type Client, type TextChannel } from "discord.js";

import { revalidateAppData } from "../cache";
import { convex, references } from "../convex";
import { env } from "../environment";
import { logInfo, logWarn } from "../log";
import {
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
    await revalidateAppData({
      type: "discord-config-changed",
      serverId: payload.config.guildId,
    });
  }
}
