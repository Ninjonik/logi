import {
  ChannelType,
  DiscordAPIError,
  EmbedBuilder,
  type Client,
  type ColorResolvable,
  type TextChannel,
} from "discord.js";

import { convex, references } from "./convex";
import { logWarn } from "./log";

type ClanErrorReportInput = {
  client: Client;
  guildId: string;
  error: unknown;
  action: string;
  location: string;
  scope: string;
  target?: string;
  details?: Record<string, string | undefined>;
};

function isDiscordMissingPermissionsError(error: unknown) {
  if (error instanceof DiscordAPIError) {
    return error.code === 50013;
  }

  if (typeof error === "object" && error !== null) {
    const maybeCode = "code" in error ? (error as { code?: unknown }).code : undefined;
    const maybeRawCode = "rawError" in error
      ? (error as { rawError?: { code?: unknown } }).rawError?.code
      : undefined;

    return maybeCode === 50013 || maybeRawCode === 50013;
  }

  return false;
}

function summarizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown Discord error.";
}

function truncate(value: string, max = 1024) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

export async function reportClanDiscordError(input: ClanErrorReportInput) {
  const config = await convex.query(references.getConfigByDiscordGuildId, {
    guildId: input.guildId,
  }) as { errorsChannelId?: string } | null;

  if (!config?.errorsChannelId) {
    return;
  }

  const guild = await input.client.guilds.fetch(input.guildId).catch(() => null);
  if (!guild) {
    return;
  }

  const channel = await guild.channels.fetch(config.errorsChannelId).catch(() => null);
  if (!channel?.isTextBased() || channel.type !== ChannelType.GuildText) {
    return;
  }

  const isMissingPermissions = isDiscordMissingPermissionsError(input.error);
  const summary = summarizeError(input.error);
  const color: ColorResolvable = isMissingPermissions ? 0xe11d48 : 0xf59e0b;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(isMissingPermissions ? "Bot missing permissions" : "Bot action failed")
    .setDescription(
      isMissingPermissions
        ? "Logi tried to do something in Discord, but Discord blocked it because the bot is missing permissions."
        : "Logi hit a Discord-related error while handling an action for this clan.",
    )
    .addFields(
      { name: "Where", value: truncate(input.location), inline: true },
      { name: "While doing", value: truncate(input.action), inline: true },
      { name: "Scope", value: truncate(input.scope), inline: true },
      { name: "Discord said", value: truncate(summary) },
    )
    .setTimestamp(new Date());

  if (input.target) {
    embed.addFields({ name: "Target", value: truncate(input.target) });
  }

  const detailLines = Object.entries(input.details ?? {})
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `• ${key}: ${value}`);
  if (detailLines.length) {
    embed.addFields({ name: "Details", value: truncate(detailLines.join("\n")) });
  }

  await (channel as TextChannel).send({ embeds: [embed] }).catch((error) => {
    logWarn("error-reporting", "Failed to post clan error report", {
      guildId: input.guildId,
      scope: input.scope,
      error,
    });
    return null;
  });
}
