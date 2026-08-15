import {
  ActionRowBuilder,
  type APIMessageComponentEmoji,
  AutocompleteInteraction,
  ButtonInteraction,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  StringSelectMenuInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { getClanDiscordMessages } from "../../src/lib/clan-language";
import { detectPlatformFromId, getPlatformProfileUrl, stripPlatformPrefix } from "../../src/lib/platform-ids";

import { revalidateAppData } from "./cache";
import { convex, references } from "./convex";
import { client } from "./discord-client";
import { env } from "./environment";
import { reportClanDiscordError } from "./error-reporting";
import { handleEventButtonInteraction } from "./interactions/event-buttons";
import {
  buildMockPlayerMessage,
  buildPlatformGuideMessage,
  buildPlatformLinkApplyModalId,
  buildPlatformLinkCustomId,
  buildPlatformLinkManageMessage,
  buildPlatformLinkModalId,
  buildPlatformLinkMockApplyModalId,
  buildPlatformLinkSearchModalId,
  buildPlayerSearchResultsMessage,
  buildPlatformLinkStartMessage,
  buildPlatformSelectMessageWithEmojis,
  buildPlayedBeforeMessage,
  getPlatformFlowMessages,
  buildUnlinkPlatformMessage,
  parsePlatformLinkApplyModalId,
  parsePlatformLinkInteractionId,
  parsePlatformLinkModalId,
  parsePlatformLinkMockApplyModalId,
  parsePlatformLinkSearchModalId,
} from "./interactions/platform-link";
import {
  cleanupThread,
  formatTemplate,
  getOutcomeLabel,
  loadMembershipCategoryContext,
  loadTicketCategoryContext,
  resolveSupportMemberIds,
  rollbackMembershipApplicationSetup,
  syncMembershipRoles,
} from "./interactions/shared";
import { detectPlatformFromStatsId, extractPlayerSearchResults } from "./interactions/player-search";
import { logError, logInfo, logWarn } from "./log";
import { buildMembershipApplicationThreadEmbed, buildTicketThreadEmbed } from "./message-builders";
import type { EventInteractionContext, MembershipApplicationThreadRecord, MembershipCategory, TicketCategory, TicketThreadRecord } from "./types";
import { slugifyTicketLabel } from "./utils";

type InteractionHandlerOptions = {
  enqueueEventSync: (eventId: string) => void;
  triggerPollSoon: () => void;
};

type TicketAnswer = {
  questionId: string;
  label: string;
  value: string;
};

type MembershipAnswer = TicketAnswer;

type MembershipPrereq = {
  config: EventInteractionContext["config"];
  category: MembershipCategory;
  user: { platformIds?: string[] } | null;
  assignment: { id: string; membershipCategoryId?: string } | null;
  hasOpenApplication: boolean;
};

type PlatformLinkState = {
  id: string;
  platformIds: string[];
  name: string;
} | null;

type PlatformEmojiMap = Partial<Record<"steam" | "epic" | "xbox" | "playstation", APIMessageComponentEmoji>>;
type PlayerSearchResult = {
  playerId: string;
  playerName: string;
  sourceLabel: string;
  platform: "steam" | "epic" | "xbox" | "playstation" | "other";
};

type ClanPlayerAutocompleteResult = {
  id: string;
  name: string;
  avatar: string;
  discordId: string;
  platformIds: string[];
  assignmentType?: "member" | "mercenary";
  assignmentStatus?: "pending" | "recruit" | "active";
  matchesPlayed: number;
  averageKills: number;
  averageKd: number;
  score: number;
};

type ClanPlayerProfile = {
  id: string;
  name: string;
  avatar: string;
  discordId: string;
  linkedDiscordId?: string;
  hasDiscordLink: boolean;
  platformIds: string[];
  guildId?: string;
  assignment: {
    type: "member" | "mercenary";
    status: "pending" | "recruit" | "active";
    membershipCategoryId?: string;
    paused: boolean;
    pausedNote?: string;
  };
  score: number;
  performance: {
    matchesPlayed: number;
    averages: {
      kills: number;
      killDeathRatio: number;
      deaths: number;
      offense: number;
      defense: number;
      support: number;
    };
  };
  recentMatches: Array<{
    mapName?: string;
    mapId: string;
    team: string;
    endedAt?: string;
    importedAt: string;
    kills: number;
    deaths: number;
    killDeathRatio: number;
    offense: number;
    defense: number;
    support: number;
    sourceUrl: string;
  }>;
  updatedAt: string;
  createdAt: string;
};

let platformEmojiCache: PlatformEmojiMap | null = null;

function formatDiscordTimestamp(date: Date) {
  return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

function formatNumber(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.0";
}

function formatShortDateTimestamp(value?: string) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return `<t:${Math.floor(date.getTime() / 1000)}:d>`;
}

function getAssignmentBadge(input: { type?: "member" | "mercenary"; status?: "pending" | "recruit" | "active" }) {
  const typeLabel = input.type === "mercenary" ? "Mercenary" : "Member";
  const statusLabel = input.status === "pending" ? "Pending" : input.status === "recruit" ? "Recruit" : "Active";
  return `${typeLabel} • ${statusLabel}`;
}

function buildClanPlayerOptionLabel(player: ClanPlayerAutocompleteResult) {
  return `${player.name} • ${getAssignmentBadge({
    type: player.assignmentType,
    status: player.assignmentStatus,
  })}`.slice(0, 100);
}

function buildClanPlayerOptionValue(player: ClanPlayerAutocompleteResult) {
  return player.id;
}

function buildClanPlayerOptionDescription(player: ClanPlayerAutocompleteResult) {
  const parts = [
    player.matchesPlayed ? `${player.matchesPlayed} matches` : "No imported matches",
    `KD ${formatNumber(player.averageKd)}`,
  ];
  return parts.join(" • ").slice(0, 100);
}

function buildPlatformFieldValue(platformIds: string[]) {
  const lines = platformIds.map((platformId) => {
    const platform = detectPlatformFromId(platformId);
    const label = platform === "steam"
      ? "Steam"
      : platform === "epic"
        ? "Epic"
        : platform === "xbox"
          ? "Xbox"
          : platform === "playstation"
            ? "PlayStation"
            : "Platform";
    const rawId = stripPlatformPrefix(platformId);
    const profileUrl = getPlatformProfileUrl(platformId);
    return profileUrl ? `[${label}: ${rawId}](${profileUrl})` : `${label}: \`${rawId}\``;
  });

  return lines.join("\n").slice(0, 1024);
}

function buildRecentMatchesValue(profile: ClanPlayerProfile) {
  if (!profile.recentMatches.length) {
    return "No imported match history.";
  }

  return profile.recentMatches.map((match) => {
    const mapLabel = match.mapName?.trim() || match.mapId;
    return `${formatShortDateTimestamp(match.endedAt ?? match.importedAt)} ${mapLabel} • ${match.kills}/${match.deaths} • KD ${formatNumber(match.killDeathRatio)}`;
  }).join("\n").slice(0, 1024);
}

function buildClanPlayerProfileEmbed(profile: ClanPlayerProfile) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(profile.name)
    .setThumbnail(profile.avatar)
    .addFields(
      { name: "Status", value: getAssignmentBadge(profile.assignment), inline: true },
      { name: "Clan score", value: String(profile.score ?? 0), inline: true },
      { name: "Matches", value: String(profile.performance.matchesPlayed ?? 0), inline: true },
      { name: "Average kills", value: formatNumber(profile.performance.averages.kills), inline: true },
      { name: "Average deaths", value: formatNumber(profile.performance.averages.deaths), inline: true },
      { name: "Average KD", value: formatNumber(profile.performance.averages.killDeathRatio), inline: true },
      { name: "Average offense", value: formatNumber(profile.performance.averages.offense), inline: true },
      { name: "Average defense", value: formatNumber(profile.performance.averages.defense), inline: true },
      { name: "Average support", value: formatNumber(profile.performance.averages.support), inline: true },
      { name: "Discord", value: profile.hasDiscordLink ? `<@${profile.linkedDiscordId ?? profile.discordId}>` : `\`${profile.discordId}\`` },
      { name: "Platforms", value: profile.platformIds.length ? buildPlatformFieldValue(profile.platformIds) : "No linked platforms." },
      { name: "Recent matches", value: buildRecentMatchesValue(profile) },
    )
    .setFooter({ text: `Player ID: ${profile.id}` })
    .setTimestamp(new Date(profile.updatedAt));

  if (profile.assignment.paused) {
    embed.addFields({
      name: "Assignment state",
      value: profile.assignment.pausedNote?.trim() ? `Paused: ${profile.assignment.pausedNote}` : "Paused",
    });
  }

  return embed;
}

function buildTicketCloseEmbed(input: {
  messages: ReturnType<typeof getClanDiscordMessages>;
  ticketNumber: number;
  closerId: string;
  closedAt: Date;
  reason?: string;
}) {
  const { messages, ticketNumber, closerId, closedAt, reason } = input;
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${messages.ticket.closeEmbedTitle} #${ticketNumber}`)
    .addFields(
      { name: messages.ticket.closedByLabel, value: `<@${closerId}>`, inline: true },
      { name: messages.ticket.closedAtLabel, value: formatDiscordTimestamp(closedAt), inline: true },
    )
    .setTimestamp(closedAt);

  if (reason) {
    embed.addFields({ name: messages.ticket.reasonLabel, value: reason });
  }

  return embed;
}

function buildMembershipApplicationCloseEmbed(input: {
  messages: ReturnType<typeof getClanDiscordMessages>;
  applicationNumber: number;
  closerId: string;
  closedAt: Date;
  outcomeLabel: string;
  reason?: string;
}) {
  const { messages, applicationNumber, closerId, closedAt, outcomeLabel, reason } = input;

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${messages.membership.closeEmbedTitle} #${applicationNumber}`)
    .addFields(
      { name: messages.membership.closedByLabel, value: `<@${closerId}>`, inline: true },
      { name: messages.membership.closedAtLabel, value: formatDiscordTimestamp(closedAt), inline: true },
      reason
        ? { name: messages.membership.reasonLabel, value: reason }
        : { name: messages.membership.outcomeLabel, value: outcomeLabel },
    )
    .setTimestamp(closedAt);
}

export function createInteractionHandler(options: InteractionHandlerOptions) {
  return {
    async handleButtonInteraction(interaction: ButtonInteraction) {
      if (interaction.customId.startsWith("signup:") || interaction.customId.startsWith("attendance:")) {
        await handleEventButtonInteraction(interaction, options);
        return;
      }

      if (interaction.customId.startsWith("ticket:")) {
        await handleTicketButtonInteraction(interaction);
        return;
      }

      if (interaction.customId.startsWith("membership:")) {
        await handleMembershipButtonInteraction(interaction);
        return;
      }

      if (interaction.customId.startsWith("plink:")) {
        await handlePlatformLinkButtonInteraction(interaction);
      }
    },

    async handleStringSelectMenuInteraction(interaction: StringSelectMenuInteraction) {
      if (interaction.customId.startsWith("plink:")) {
        await handlePlatformLinkSelectInteraction(interaction);
      }
    },

    async handleModalSubmit(interaction: ModalSubmitInteraction) {
      if (interaction.customId.startsWith("ticket-modal:")) {
        await handleTicketModalSubmit(interaction);
      } else if (interaction.customId.startsWith("membership-modal:")) {
        await handleMembershipModalSubmit(interaction);
      } else if (interaction.customId.startsWith("plink-modal:")) {
        await handlePlatformLinkModalSubmit(interaction);
      } else if (interaction.customId.startsWith("plink-search:")) {
        await handlePlatformLinkSearchModalSubmit(interaction);
      } else if (interaction.customId.startsWith("plink-apply:")) {
        await handlePlatformLinkApplyModalSubmit(interaction);
      } else if (interaction.customId.startsWith("plink-mock-apply:")) {
        await handlePlatformLinkMockApplyModalSubmit(interaction);
      } else if (interaction.customId.startsWith("notice-modal:")) {
        await handleNoticeModalSubmit(interaction);
      }
    },

    async handleAutocompleteInteraction(interaction: AutocompleteInteraction) {
      if (interaction.commandName === "notice") {
        await handleNoticeAutocomplete(interaction);
      } else if (interaction.commandName === "player") {
        await handlePlayerAutocomplete(interaction);
      }
    },

    async handleChatInputCommand(interaction: ChatInputCommandInteraction) {
      if (interaction.commandName === "close_ticket") {
        await handleCloseTicketCommand(interaction);
      } else if (interaction.commandName === "close_application") {
        await handleCloseApplicationCommand(interaction);
      } else if (interaction.commandName === "link") {
        await handleLinkCommand(interaction);
      } else if (interaction.commandName === "notice") {
        await handleNoticeCommand(interaction);
      } else if (interaction.commandName === "player") {
        await handlePlayerCommand(interaction);
      }
    },

    async registerGuildCommands(guild: import("discord.js").Guild) {
      const messages = getClanDiscordMessages(guild.preferredLocale === "cs" ? "cs" : "en");
      const commands = [
        new SlashCommandBuilder()
          .setName("close_ticket")
          .setDescription(messages.commands.closeTicketDescription)
          .setDescriptionLocalizations({ cs: getClanDiscordMessages("cs").commands.closeTicketDescription })
          .addStringOption((option) =>
            option
              .setName("reason")
              .setDescription(messages.commands.reasonOptionDescription)
              .setDescriptionLocalizations({ cs: getClanDiscordMessages("cs").commands.reasonOptionDescription })
              .setMaxLength(500)
              .setRequired(false),
          )
          .setDMPermission(false),
        new SlashCommandBuilder()
          .setName("close_application")
          .setDescription(messages.commands.closeApplicationDescription)
          .setDescriptionLocalizations({ cs: getClanDiscordMessages("cs").commands.closeApplicationDescription })
          .addStringOption((option) =>
            option
              .setName("outcome")
              .setDescription(messages.commands.outcomeOptionDescription)
              .setDescriptionLocalizations({ cs: getClanDiscordMessages("cs").commands.outcomeOptionDescription })
              .setRequired(true)
              .addChoices(
                { name: getClanDiscordMessages("en").commands.outcomeDenied, value: "denied", name_localizations: { cs: getClanDiscordMessages("cs").commands.outcomeDenied } },
                { name: getClanDiscordMessages("en").commands.outcomePending, value: "pending", name_localizations: { cs: getClanDiscordMessages("cs").commands.outcomePending } },
                { name: getClanDiscordMessages("en").commands.outcomeRecruit, value: "recruit", name_localizations: { cs: getClanDiscordMessages("cs").commands.outcomeRecruit } },
                { name: getClanDiscordMessages("en").commands.outcomeMember, value: "member", name_localizations: { cs: getClanDiscordMessages("cs").commands.outcomeMember } },
                { name: getClanDiscordMessages("en").commands.outcomeMercenary, value: "mercenary", name_localizations: { cs: getClanDiscordMessages("cs").commands.outcomeMercenary } },
              ),
          )
          .addStringOption((option) =>
            option
              .setName("reason")
              .setDescription(messages.commands.reasonOptionDescription)
              .setDescriptionLocalizations({ cs: getClanDiscordMessages("cs").commands.reasonOptionDescription })
              .setMaxLength(500)
              .setRequired(false),
          )
          .setDMPermission(false),
        new SlashCommandBuilder()
          .setName("notice")
          .setDescription(messages.commands.noticeDescription)
          .setDescriptionLocalizations({ cs: getClanDiscordMessages("cs").commands.noticeDescription })
          .addStringOption((option) =>
            option
              .setName("event")
              .setDescription(messages.commands.noticeEventOptionDescription)
              .setDescriptionLocalizations({ cs: getClanDiscordMessages("cs").commands.noticeEventOptionDescription })
              .setRequired(true)
              .setAutocomplete(true),
          )
          .setDMPermission(false),
        new SlashCommandBuilder()
          .setName("link")
          .setDescription(messages.commands.linkDescription)
          .setDescriptionLocalizations({ cs: getClanDiscordMessages("cs").commands.linkDescription })
          .setDMPermission(false),
        new SlashCommandBuilder()
          .setName("player")
          .setDescription("Search clan players and view their stats")
          .addStringOption((option) =>
            option
              .setName("player")
              .setDescription("Pick a player from this clan")
              .setRequired(true)
              .setAutocomplete(true),
          )
          .setDMPermission(false),
      ];

      await guild.commands.set(commands.map((command) => command.toJSON()));
    },
  };

  async function handleTicketButtonInteraction(interaction: ButtonInteraction) {
    const fallbackMessages = getClanDiscordMessages("en");
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: fallbackMessages.ticket.serverOnly, flags: MessageFlags.Ephemeral });
      return;
    }

    const categoryId = interaction.customId.replace("ticket:", "");
    const context = await loadTicketCategoryContext(interaction.guildId, categoryId);
    const messages = getClanDiscordMessages(context?.config.defaultLanguage);
    if (!context?.config.ticketSettings?.enabled) {
      await interaction.reply({ content: messages.ticket.unavailable, flags: MessageFlags.Ephemeral });
      return;
    }

    if (context.category.modalQuestions.length) {
      const modal = new ModalBuilder()
        .setCustomId(`ticket-modal:${categoryId}`)
        .setTitle((context.category.label?.trim() || messages.ticket.modalTitle).slice(0, 45));

      for (const question of context.category.modalQuestions.slice(0, 5)) {
        const input = new TextInputBuilder()
          .setCustomId(question.id)
          .setLabel(question.label.slice(0, 45))
          .setStyle(question.style === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(question.required)
          .setMaxLength(question.style === "paragraph" ? 1000 : 400);

        if (question.placeholder) {
          input.setPlaceholder(question.placeholder.slice(0, 100));
        }

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      }

      await interaction.showModal(modal);
      return;
    }

    await createDiscordTicket(interaction, context.category, []);
  }

  async function handleNoticeCommand(interaction: ChatInputCommandInteraction) {
    const fallbackMessages = getClanDiscordMessages("en");
    if (!interaction.guildId) {
      await interaction.reply({ content: fallbackMessages.membership.serverOnly, flags: MessageFlags.Ephemeral });
      return;
    }

    const eventSelection = interaction.options.getString("event", true).trim();
    const guildConfig = await convex.query(references.getConfigByDiscordGuildId, {
      guildId: interaction.guildId,
    }).catch(() => null) as { defaultLanguage?: "en" | "cs" } | null;
    const messages = getClanDiscordMessages(guildConfig?.defaultLanguage);

    const matches = await convex.query(references.findNoticeTarget, {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      query: eventSelection,
    }) as Array<{ id: string; name: string }>;

    logInfo("interaction", "Resolved notice command candidates", {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      eventSelection,
      matchCount: matches.length,
      matchIds: matches.map((event) => event.id),
      matchNames: matches.map((event) => event.name),
    });

    const exactIdMatch = matches.find((event) => event.id === eventSelection);
    if (exactIdMatch) {
      await openNoticeModal(interaction, exactIdMatch.id, messages.commands.noticeModalTitle, messages.commands.noticeReasonLabel);
      return;
    }

    if (!matches.length) {
      await interaction.reply({ content: messages.commands.noticeNoMatch, flags: MessageFlags.Ephemeral });
      return;
    }

    const exactNameMatches = matches.filter((event) => event.name.trim().toLowerCase() === eventSelection.toLowerCase());
    if (exactNameMatches.length === 1) {
      await openNoticeModal(interaction, exactNameMatches[0].id, messages.commands.noticeModalTitle, messages.commands.noticeReasonLabel);
      return;
    }

    if (matches.length > 1) {
      await interaction.reply({ content: messages.commands.noticeMultipleMatches, flags: MessageFlags.Ephemeral });
      return;
    }

    await openNoticeModal(interaction, matches[0].id, messages.commands.noticeModalTitle, messages.commands.noticeReasonLabel);
  }

  async function handlePlayerAutocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guildId) {
      await interaction.respond([]);
      return;
    }

    const query = interaction.options.getFocused(true);
    if (query.name !== "player") {
      await interaction.respond([]);
      return;
    }

    const matches = await convex.query(references.searchClanPlayers, {
      guildId: interaction.guildId,
      query: String(query.value ?? ""),
      limit: 5,
    }).catch(() => []) as ClanPlayerAutocompleteResult[];

    await interaction.respond(matches.map((player) => ({
      name: buildClanPlayerOptionLabel(player),
      value: buildClanPlayerOptionValue(player),
    })));
  }

  async function handlePlayerCommand(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();

    const playerId = interaction.options.getString("player", true).trim();
    const profile = await convex.query(references.getClanPlayerProfile, {
      guildId: interaction.guildId,
      userId: playerId,
    }).catch(() => null) as ClanPlayerProfile | null;

    if (!profile) {
      await interaction.editReply({ content: "Player not found in this clan." });
      return;
    }

    await interaction.editReply({
      embeds: [buildClanPlayerProfileEmbed(profile)],
    });
  }

  async function handleNoticeAutocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guildId) {
      logInfo("interaction", "Ignored notice autocomplete outside guild", {
        userId: interaction.user.id,
      });
      await interaction.respond([]);
      return;
    }

    const query = interaction.options.getFocused(true);
    if (query.name !== "event") {
      logInfo("interaction", "Ignored notice autocomplete for unexpected option", {
        guildId: interaction.guildId,
        userId: interaction.user.id,
        optionName: query.name,
      });
      await interaction.respond([]);
      return;
    }

    logInfo("interaction", "Received notice autocomplete", {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      query: String(query.value ?? ""),
    });

    const matches = await convex.query(references.findNoticeTarget, {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      query: String(query.value ?? ""),
    }).catch(() => []) as Array<{ id: string; name: string; gameStart?: string }>;

    logInfo("interaction", "Resolved notice autocomplete candidates", {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      query: String(query.value ?? ""),
      matchCount: matches.length,
      matchIds: matches.map((event) => event.id),
      matchNames: matches.map((event) => event.name),
      matchGameStarts: matches.map((event) => event.gameStart),
    });

    await interaction.respond(matches.slice(0, 25).map((event) => ({
      name: formatNoticeAutocompleteLabel(event.name, event.gameStart),
      value: event.id,
    })));
  }

  async function openNoticeModal(
    interaction: ChatInputCommandInteraction,
    eventId: string,
    modalTitle: string,
    reasonLabel: string,
  ) {
    const modal = new ModalBuilder()
      .setCustomId(`notice-modal:${eventId}`)
      .setTitle(modalTitle.slice(0, 45));

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel(reasonLabel.slice(0, 45))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500),
      ),
    );

    await interaction.showModal(modal);
  }

  function formatNoticeAutocompleteLabel(name: string, gameStart?: string) {
    if (!gameStart) {
      return name.slice(0, 100);
    }

    const timestamp = new Date(gameStart);
    if (Number.isNaN(timestamp.getTime())) {
      return name.slice(0, 100);
    }

    return `${name} • ${timestamp.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    })} UTC`.slice(0, 100);
  }

  async function handleNoticeModalSubmit(interaction: ModalSubmitInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: getClanDiscordMessages("en").membership.serverOnly, flags: MessageFlags.Ephemeral });
      return;
    }

    const eventId = interaction.customId.replace("notice-modal:", "");
    const guildConfig = await convex.query(references.getConfigByDiscordGuildId, {
      guildId: interaction.guildId,
    }).catch(() => null) as { defaultLanguage?: "en" | "cs" } | null;
    const messages = getClanDiscordMessages(guildConfig?.defaultLanguage);

    await convex.mutation(references.upsertNotice, {
      secret: env.internalSecret,
      eventId: eventId as never,
      userId: interaction.user.id,
      reason: interaction.fields.getTextInputValue("reason"),
    });

    await revalidateAppData({
      type: "event-changed",
      serverId: interaction.guildId,
      eventId,
    });
    options.enqueueEventSync(eventId);
    options.triggerPollSoon();

    await interaction.reply({ content: messages.commands.noticeSaved, flags: MessageFlags.Ephemeral });
  }

  async function handleLinkCommand(interaction: ChatInputCommandInteraction) {
    const fallbackMessages = getClanDiscordMessages("en");
    if (!interaction.guildId) {
      await interaction.reply({ content: fallbackMessages.membership.serverOnly, flags: MessageFlags.Ephemeral });
      return;
    }

    const guildConfig = await convex.query(references.getConfigByDiscordGuildId, {
      guildId: interaction.guildId,
    }).catch(() => null) as { defaultLanguage?: "en" | "cs" } | null;
    const language = guildConfig?.defaultLanguage ?? "en";
    const linkState = await loadDiscordPlatformLinkState(interaction.user.id);
    const emojis = await getPlatformEmojis();
    await interaction.reply({
      ...(linkState?.platformIds?.length
        ? buildPlatformLinkManageMessage({ language, platformIds: linkState.platformIds, emojis })
        : buildPlatformLinkStartMessage(language, { mode: "link" })),
      flags: MessageFlags.Ephemeral,
    });
  }

  async function handleTicketModalSubmit(interaction: ModalSubmitInteraction) {
    const fallbackMessages = getClanDiscordMessages("en");
    if (!interaction.guildId) {
      await interaction.reply({ content: fallbackMessages.ticket.serverOnly, flags: MessageFlags.Ephemeral });
      return;
    }

    const categoryId = interaction.customId.replace("ticket-modal:", "");
    const context = await loadTicketCategoryContext(interaction.guildId, categoryId);
    const messages = getClanDiscordMessages(context?.config.defaultLanguage);
    if (!context?.config.ticketSettings?.enabled) {
      await interaction.reply({ content: messages.ticket.unavailable, flags: MessageFlags.Ephemeral });
      return;
    }

    const answers = context.category.modalQuestions.map((question) => ({
      questionId: question.id,
      label: question.label,
      value: interaction.fields.getTextInputValue(question.id).trim(),
    }));

    await createDiscordTicket(interaction, context.category, answers);
  }

  async function handleMembershipButtonInteraction(interaction: ButtonInteraction) {
    const fallbackMessages = getClanDiscordMessages("en");
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: fallbackMessages.membership.serverOnly, flags: MessageFlags.Ephemeral });
      return;
    }

    const categoryId = interaction.customId.replace("membership:", "");
    const prereq = await loadMembershipApplicationPrereq(interaction.guildId, categoryId, interaction.user.id);
    const messages = getClanDiscordMessages(prereq?.config.defaultLanguage);

    if (!prereq?.config.membershipSettings?.enabled) {
      await interaction.reply({ content: messages.membership.unavailable, flags: MessageFlags.Ephemeral });
      return;
    }

    if (prereq.assignment) {
      await interaction.reply({ content: messages.membership.alreadyInClan, flags: MessageFlags.Ephemeral });
      return;
    }

    if (prereq.hasOpenApplication) {
      await interaction.reply({ content: messages.membership.openApplicationExists, flags: MessageFlags.Ephemeral });
      return;
    }

    if (!prereq.user || !prereq.user.platformIds?.length) {
      await interaction.reply({
        ...buildPlatformLinkStartMessage(prereq.config.defaultLanguage, { mode: "membership", categoryId }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await continueMembershipApplicationFlow(interaction, prereq);
  }

  async function handlePlatformLinkButtonInteraction(interaction: ButtonInteraction) {
    const parsed = parsePlatformLinkInteractionId(interaction.customId);
    const context = parsed?.context;
    const language = await getGuildLanguage(interaction.guildId);
    const flowMessages = getPlatformFlowMessages(language);
    if (!parsed || !context) {
      await interaction.reply({ content: flowMessages.invalidAction, flags: MessageFlags.Ephemeral });
      return;
    }

    const emojis = await getPlatformEmojis();

    if (parsed.step === "start") {
      if (await hasConfiguredStatsServers(interaction.guildId)) {
        await interaction.update(buildPlayedBeforeMessage(language, context));
        return;
      }

      await interaction.update(buildPlatformSelectMessageWithEmojis({ language, context, emojis }));
      return;
    }

    if (parsed.step === "player-search") {
      await interaction.showModal(buildPlayerSearchModal(context, language));
      return;
    }

    if (parsed.step === "unlink" && context.mode === "link") {
      const linkState = await loadDiscordPlatformLinkState(interaction.user.id);
      await interaction.update(buildUnlinkPlatformMessage({
        language,
        platformIds: linkState?.platformIds ?? [],
        emojis,
      }));
      return;
    }

    if (parsed.step === "manual" && parsed.extra) {
      if (parsed.extra !== "steam" && parsed.extra !== "epic" && parsed.extra !== "xbox" && parsed.extra !== "playstation") {
        await interaction.reply({ content: getClanDiscordMessages(language).platformFlow?.invalidPlatformId ?? "Invalid platform.", flags: MessageFlags.Ephemeral });
        return;
      }

      if (context.mode === "membership" && context.categoryId) {
        const categoryContext = await loadMembershipCategoryContext(interaction.guildId!, context.categoryId);
        const messages = getClanDiscordMessages(categoryContext?.config.defaultLanguage ?? language);
        if (!categoryContext?.config.membershipSettings?.enabled) {
          await interaction.reply({ content: messages.membership.unavailable, flags: MessageFlags.Ephemeral });
          return;
        }

        if (categoryContext.category.modalQuestions.length) {
          await interaction.showModal(buildPlatformAndMembershipModal(context.categoryId, parsed.extra, categoryContext.category, messages.membership.modalTitle));
          return;
        }
      }

      await interaction.showModal(buildPlatformIdOnlyModal(buildPlatformLinkModalId(context, parsed.extra), parsed.extra, language));
    }
  }

  async function handlePlatformLinkSelectInteraction(interaction: StringSelectMenuInteraction) {
    const parsed = parsePlatformLinkInteractionId(interaction.customId);
    const context = parsed?.context;
    const language = await getGuildLanguage(interaction.guildId);
    const flowMessages = getPlatformFlowMessages(language);
    if (!parsed || !context) {
      await interaction.reply({ content: flowMessages.invalidAction, flags: MessageFlags.Ephemeral });
      return;
    }

    const value = interaction.values[0];
    const emojis = await getPlatformEmojis();

    if (parsed.step === "played") {
      if (value === "yes") {
        await interaction.update(buildMockPlayerMessage(language, context));
        return;
      }

      await interaction.update(buildPlatformSelectMessageWithEmojis({ language, context, emojis }));
      return;
    }

    if (parsed.step === "platform") {
      if (value !== "steam" && value !== "epic" && value !== "xbox" && value !== "playstation") {
        await interaction.reply({ content: getClanDiscordMessages(language).platformFlow?.invalidPlatformId ?? "Invalid platform.", flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.update(buildPlatformGuideMessage(language, context, value, emojis));
      return;
    }

    if (parsed.step === "unlink-select" && context.mode === "link") {
      await convex.mutation(references.unlinkDiscordPlatformId, {
        secret: env.internalSecret,
        userId: interaction.user.id,
        platformId: value,
      });
      const linkState = await loadDiscordPlatformLinkState(interaction.user.id);
      await interaction.update(buildPlatformLinkManageMessage({
        language,
        platformIds: linkState?.platformIds ?? [],
        emojis,
      }));
      return;
    }

    if (parsed.step === "player") {
      if (context.mode === "membership" && context.categoryId) {
        const prereq = await loadMembershipApplicationPrereq(interaction.guildId!, context.categoryId, interaction.user.id);
        const messages = getClanDiscordMessages(prereq?.config.defaultLanguage ?? language);
        if (!prereq?.config.membershipSettings?.enabled) {
          await interaction.reply({ content: messages.membership.unavailable, flags: MessageFlags.Ephemeral });
          return;
        }

        if (prereq.category.modalQuestions.length) {
          await interaction.showModal(buildPlayerLinkedMembershipModal(context.categoryId, value, prereq.category, messages.membership.modalTitle));
          return;
        }

        await savePlatformIdLink(interaction.user.id, interaction.user.globalName ?? interaction.user.username, interaction.user.displayAvatarURL(), value);
        await createDiscordMembershipApplication(interaction, prereq.category, []);
        return;
      }

      await savePlatformIdLink(interaction.user.id, interaction.user.globalName ?? interaction.user.username, interaction.user.displayAvatarURL(), value);
      const linkState = await loadDiscordPlatformLinkState(interaction.user.id);
      await interaction.update(buildPlatformLinkManageMessage({
        language,
        platformIds: linkState?.platformIds ?? [],
        emojis,
      }));
    }
  }

  async function handleMembershipModalSubmit(interaction: ModalSubmitInteraction) {
    const fallbackMessages = getClanDiscordMessages("en");
    if (!interaction.guildId) {
      await interaction.reply({ content: fallbackMessages.membership.serverOnly, flags: MessageFlags.Ephemeral });
      return;
    }

    const categoryId = interaction.customId.replace("membership-modal:", "");
    const context = await loadMembershipCategoryContext(interaction.guildId, categoryId);
    const messages = getClanDiscordMessages(context?.config.defaultLanguage);
    if (!context?.config.membershipSettings?.enabled) {
      await interaction.reply({ content: messages.membership.unavailable, flags: MessageFlags.Ephemeral });
      return;
    }

    const answers = context.category.modalQuestions.map((question) => ({
      questionId: question.id,
      label: question.label,
      value: interaction.fields.getTextInputValue(question.id).trim(),
    }));

    await createDiscordMembershipApplication(interaction, context.category, answers);
  }

  async function handlePlatformLinkModalSubmit(interaction: ModalSubmitInteraction) {
    const parsed = parsePlatformLinkModalId(interaction.customId);
    const language = await getGuildLanguage(interaction.guildId);
    const flowMessages = getPlatformFlowMessages(language);
    if (!parsed?.context) {
      await interaction.reply({ content: flowMessages.invalidModal, flags: MessageFlags.Ephemeral });
      return;
    }

    const platformId = interaction.fields.getTextInputValue("platformId").trim();
    const messages = getClanDiscordMessages(language);
    if (!platformId || /\s/.test(platformId)) {
      await interaction.reply({ content: messages.platformFlow?.invalidPlatformId ?? "Enter a platform ID without spaces.", flags: MessageFlags.Ephemeral });
      return;
    }

    await savePlatformIdLink(
      interaction.user.id,
      interaction.user.globalName ?? interaction.user.username,
      interaction.user.displayAvatarURL(),
      toStoredPlatformId(parsed.platform, platformId),
    );

    if (parsed.context.mode === "membership" && parsed.context.categoryId) {
      const prereq = await loadMembershipApplicationPrereq(interaction.guildId!, parsed.context.categoryId, interaction.user.id);
      if (!prereq) {
        await interaction.reply({ content: getClanDiscordMessages("en").membership.unavailable, flags: MessageFlags.Ephemeral });
        return;
      }

      await createDiscordMembershipApplication(interaction, prereq.category, []);
      return;
    }

    const linkState = await loadDiscordPlatformLinkState(interaction.user.id);
    const emojis = await getPlatformEmojis();
    await interaction.reply({
      ...buildPlatformLinkManageMessage({
        language,
        platformIds: linkState?.platformIds ?? [],
        emojis,
      }),
      flags: MessageFlags.Ephemeral,
    });
  }

  async function handlePlatformLinkSearchModalSubmit(interaction: ModalSubmitInteraction) {
    const context = parsePlatformLinkSearchModalId(interaction.customId);
    const language = await getGuildLanguage(interaction.guildId);
    const flowMessages = getPlatformFlowMessages(language);
    if (!context || !interaction.guildId) {
      await interaction.reply({ content: flowMessages.invalidSearchModal, flags: MessageFlags.Ephemeral });
      return;
    }

    const query = interaction.fields.getTextInputValue("query").trim();
    const results = await searchPlayerStatsServers(interaction.guildId, query);
    const emojis = await getPlatformEmojis();

    await interaction.reply({
      ...buildPlayerSearchResultsMessage({
        language,
        context,
        results: results.map((result) => ({
          playerId: result.playerId,
          playerName: result.playerName,
          description: `${result.playerId} • ${result.sourceLabel}`,
          emoji: result.platform === "other" ? undefined : emojis[result.platform],
        })),
      }),
      flags: MessageFlags.Ephemeral,
    });
  }

  async function handlePlatformLinkApplyModalSubmit(interaction: ModalSubmitInteraction) {
    const parsed = parsePlatformLinkApplyModalId(interaction.customId);
    const language = await getGuildLanguage(interaction.guildId);
    const flowMessages = getPlatformFlowMessages(language);
    if (!parsed || !interaction.guildId) {
      await interaction.reply({ content: flowMessages.invalidModal, flags: MessageFlags.Ephemeral });
      return;
    }

    const platformId = interaction.fields.getTextInputValue("platformId").trim();
    const messages = getClanDiscordMessages(language);
    if (!platformId || /\s/.test(platformId)) {
      await interaction.reply({ content: messages.platformFlow?.invalidPlatformId ?? "Enter a platform ID without spaces.", flags: MessageFlags.Ephemeral });
      return;
    }

    const context = await loadMembershipCategoryContext(interaction.guildId, parsed.categoryId);
    if (!context) {
      await interaction.reply({ content: messages.membership.unavailable, flags: MessageFlags.Ephemeral });
      return;
    }

    await savePlatformIdLink(
      interaction.user.id,
      interaction.user.globalName ?? interaction.user.username,
      interaction.user.displayAvatarURL(),
      toStoredPlatformId(parsed.platform, platformId),
    );
    await createDiscordMembershipApplication(interaction, context.category, collectMembershipAnswers(interaction, context.category, 4));
  }

  async function handlePlatformLinkMockApplyModalSubmit(interaction: ModalSubmitInteraction) {
    const parsed = parsePlatformLinkMockApplyModalId(interaction.customId);
    const language = await getGuildLanguage(interaction.guildId);
    const flowMessages = getPlatformFlowMessages(language);
    if (!parsed || !interaction.guildId) {
      await interaction.reply({ content: flowMessages.invalidModal, flags: MessageFlags.Ephemeral });
      return;
    }

    const context = await loadMembershipCategoryContext(interaction.guildId, parsed.categoryId);
    const messages = getClanDiscordMessages(language);
    if (!context) {
      await interaction.reply({ content: messages.membership.unavailable, flags: MessageFlags.Ephemeral });
      return;
    }

    await savePlatformIdLink(interaction.user.id, interaction.user.globalName ?? interaction.user.username, interaction.user.displayAvatarURL(), parsed.mockPlayerId);
    await createDiscordMembershipApplication(interaction, context.category, collectMembershipAnswers(interaction, context.category, 5));
  }

  async function getGuildLanguage(guildId: string | null) {
    if (!guildId) {
      return "en" as const;
    }

    const guildConfig = await convex.query(references.getConfigByDiscordGuildId, {
      guildId,
    }).catch(() => null) as { defaultLanguage?: "en" | "cs" } | null;

    return guildConfig?.defaultLanguage ?? "en";
  }

  async function getPlatformEmojis() {
    if (platformEmojiCache) {
      return platformEmojiCache;
    }

    const emojis = await client.application?.emojis.fetch().catch(() => null);
    const resolve = (name: string) => {
      const emoji = emojis?.find((candidate) => candidate.name === name);
      return emoji ? { id: emoji.id, name: emoji.name ?? undefined } satisfies APIMessageComponentEmoji : undefined;
    };

    platformEmojiCache = {
      steam: resolve("steam"),
      epic: resolve("epicgames"),
      xbox: resolve("xbox"),
      playstation: resolve("playstation"),
    };

    return platformEmojiCache;
  }

  async function loadMembershipApplicationPrereq(guildId: string, categoryId: string, userId: string) {
    return await convex.query(references.getMembershipApplicationPrereq, {
      secret: env.internalSecret,
      guildId,
      categoryId,
      userId,
    }) as MembershipPrereq | null;
  }

  async function loadDiscordPlatformLinkState(userId: string) {
    return await convex.query(references.getDiscordPlatformLinkState, {
      secret: env.internalSecret,
      userId,
    }) as PlatformLinkState;
  }

  async function hasConfiguredStatsServers(guildId: string | null) {
    if (!guildId) {
      return false;
    }

    const config = await convex.query(references.getConfigByDiscordGuildId, {
      guildId,
    }).catch(() => null) as EventInteractionContext["config"] | null;

    return (config?.playerStatsServers?.some((item) => item.token?.trim() && item.url?.trim()) ?? false);
  }

  async function searchPlayerStatsServers(guildId: string, query: string): Promise<PlayerSearchResult[]> {
    const config = await convex.query(references.getConfigByDiscordGuildId, {
      guildId,
    }).catch(() => null) as EventInteractionContext["config"] | null;
    const servers = config?.playerStatsServers?.filter((item) => item.token?.trim() && item.url?.trim()) ?? [];
    if (!query.trim() || !servers.length) {
      return [];
    }

    const settled = await Promise.allSettled(servers.map(async (server) => {
      const response = await fetch(server.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: server.token.trim().toLowerCase().startsWith("bearer ") ? server.token.trim() : `Bearer ${server.token.trim()}`,
        },
        body: JSON.stringify({
          page: 1,
          page_size: 50,
          flags: [],
          blacklisted: false,
          exact_name_match: false,
          ignore_accent: true,
          is_watched: false,
          player_name: query,
          country: "",
        }),
      });
      if (!response.ok) {
        throw new Error(`Stats search failed with ${response.status}`);
      }

      const body = await response.json();
      return extractPlayerSearchResults(body).map((item) => ({
        playerId: item.playerId,
        playerName: item.playerName,
        sourceLabel: new URL(server.url).hostname,
        platform: detectPlatformFromStatsId(item.playerId),
      }));
    }));

    const deduped = new Map<string, PlayerSearchResult>();
    for (const entry of settled) {
      if (entry.status !== "fulfilled") {
        continue;
      }

      for (const result of entry.value) {
        if (!deduped.has(result.playerId)) {
          deduped.set(result.playerId, result);
        }
      }
    }

    return [...deduped.values()].slice(0, 25);
  }

  async function continueMembershipApplicationFlow(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    prereq: MembershipPrereq,
  ) {
    const messages = getClanDiscordMessages(prereq.config.defaultLanguage);
    if (prereq.category.modalQuestions.length) {
      await interaction.showModal(buildMembershipQuestionsModal(
        `membership-modal:${prereq.category.id}`,
        prereq.category,
        messages.membership.modalTitle,
        5,
      ));
      return;
    }

    await createDiscordMembershipApplication(interaction, prereq.category, []);
  }

  function buildMembershipQuestionsModal(
    customId: string,
    category: MembershipCategory,
    fallbackTitle: string,
    maxQuestions: number,
  ) {
    const modal = new ModalBuilder()
      .setCustomId(customId)
      .setTitle((category.label?.trim() || fallbackTitle).slice(0, 45));

    for (const question of category.modalQuestions.slice(0, maxQuestions)) {
      const input = new TextInputBuilder()
        .setCustomId(question.id)
        .setLabel(question.label.slice(0, 45))
        .setStyle(question.style === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(question.required)
        .setMaxLength(question.style === "paragraph" ? 1000 : 400);

      if (question.placeholder) {
        input.setPlaceholder(question.placeholder.slice(0, 100));
      }

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    }

    return modal;
  }

  function buildPlayerSearchModal(context: { mode: "membership" | "link"; categoryId?: string }, language: "en" | "cs") {
    const messages = getPlatformFlowMessages(language);
    return new ModalBuilder()
      .setCustomId(buildPlatformLinkSearchModalId(context))
      .setTitle(messages.playerSearchModalTitle)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("query")
            .setLabel(messages.playerSearchModalLabel)
            .setPlaceholder(messages.playerSearchModalPlaceholder)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100),
        ),
      );
  }

  function buildPlatformIdOnlyModal(customId: string, platform: "steam" | "epic" | "xbox" | "playstation", language: "en" | "cs") {
    const messages = getClanDiscordMessages(language).platformFlow ?? getClanDiscordMessages("en").platformFlow!;
    const label = messages.guides[platform].label;

    return new ModalBuilder()
      .setCustomId(customId)
      .setTitle(messages.title.slice(0, 45))
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("platformId")
            .setLabel(label.slice(0, 45))
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(200),
        ),
      );
  }

  function buildPlatformAndMembershipModal(
    categoryId: string,
    platform: "steam" | "epic" | "xbox" | "playstation",
    category: MembershipCategory,
    fallbackTitle: string,
  ) {
    const modal = buildMembershipQuestionsModal(
      buildPlatformLinkApplyModalId(categoryId, platform),
      category,
      fallbackTitle,
      4,
    );

    modal.components.unshift(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("platformId")
          .setLabel("Platform ID")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(200),
      ),
    );

    return modal;
  }

  function buildPlayerLinkedMembershipModal(categoryId: string, playerId: string, category: MembershipCategory, fallbackTitle: string) {
    return buildMembershipQuestionsModal(
      buildPlatformLinkMockApplyModalId(categoryId, playerId),
      category,
      fallbackTitle,
      5,
    );
  }

  function collectMembershipAnswers(interaction: ModalSubmitInteraction, category: MembershipCategory, maxQuestions: number) {
    return category.modalQuestions.slice(0, maxQuestions).map((question) => ({
      questionId: question.id,
      label: question.label,
      value: interaction.fields.getTextInputValue(question.id).trim(),
    }));
  }

  async function savePlatformIdLink(userId: string, userName: string, userAvatar: string, platformId: string) {
    await convex.mutation(references.linkDiscordPlatformId, {
      secret: env.internalSecret,
      userId,
      userName,
      userAvatar,
      platformId,
    });
  }

  function toStoredPlatformId(platform: "steam" | "epic" | "xbox" | "playstation", platformId: string) {
    return `${platform}:${platformId.trim()}`;
  }

  async function createDiscordTicket(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    category: TicketCategory,
    answers: TicketAnswer[],
  ) {
    const fallbackMessages = getClanDiscordMessages("en");
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: fallbackMessages.ticket.serverOnly, flags: MessageFlags.Ephemeral });
      return;
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const categoryContext = await loadTicketCategoryContext(interaction.guildId, category.id);
    const ticketSettings = categoryContext?.config.ticketSettings;
    const messages = getClanDiscordMessages(categoryContext?.config.defaultLanguage);
    if (!categoryContext || !ticketSettings?.ticketParentChannelId) {
      await interaction.editReply({ content: messages.ticket.setupIncomplete });
      return;
    }

    const parentChannel = await interaction.guild.channels.fetch(ticketSettings.ticketParentChannelId).catch(() => null);
    if (!parentChannel || parentChannel.type !== ChannelType.GuildText) {
      await interaction.editReply({ content: messages.ticket.parentChannelNotText });
      return;
    }

    await interaction.guild.members.fetch().catch(() => null);

    const thread = await (parentChannel as TextChannel).threads.create({
      name: `${slugifyTicketLabel(category.label?.trim() || category.id)}-pending`.slice(0, 100),
      autoArchiveDuration: 10080,
      type: ChannelType.PrivateThread,
      invitable: false,
      reason: `Ticket ${category.id} opened by ${interaction.user.tag}`,
    }).catch(async (error) => {
      logError("interaction", "Failed to create ticket thread", {
        guildId: interaction.guildId,
        userId: interaction.user.id,
        categoryId: category.id,
        error,
      });
      await reportClanDiscordError({
        client,
        guildId: interaction.guildId!,
        error,
        action: "Create a ticket thread",
        location: "Ticket system",
        scope: "interaction",
        target: category.label?.trim() || category.id,
        details: {
          user: interaction.user.tag,
          categoryId: category.id,
        },
      });
      await interaction.editReply({
        content: messages.ticket.createThreadFailed,
      }).catch(() => null);
      return null;
    });
    if (!thread) {
      return;
    }

    const supportMemberIds = resolveSupportMemberIds(interaction.guild, category.supportRoleIds, categoryContext.config.dashboardAdminRoleId);
    const participantIds = [...new Set([interaction.user.id, ...supportMemberIds])];

    for (const memberId of participantIds) {
      await thread.members.add(memberId).catch((error) => {
        logWarn("interaction", "Failed to add ticket thread member", {
          guildId: interaction.guildId,
          threadId: thread.id,
          memberId,
          error,
        });
        void reportClanDiscordError({
          client,
          guildId: interaction.guildId!,
          error,
          action: "Add a participant to a ticket thread",
          location: "Ticket system",
          scope: "interaction",
          target: thread.name,
          details: {
            threadId: thread.id,
            memberId,
          },
        });
        return null;
      });
    }

    const recordResponse = await convex.mutation(references.createTicketThread, {
      secret: env.internalSecret,
      guildId: interaction.guildId,
      threadId: thread.id,
      parentChannelId: parentChannel.id,
      creatorId: interaction.user.id,
      categoryId: category.id,
      answers,
    }).catch(async (error) => {
      logError("interaction", "Failed to create ticket thread record", {
        guildId: interaction.guildId,
        threadId: thread.id,
        userId: interaction.user.id,
        categoryId: category.id,
        error,
      });
      return null;
    }) as {
      ticket: Pick<TicketThreadRecord, "ticketNumber" | "categoryLabel" | "threadId">;
      category: TicketCategory;
    } | null;
    if (!recordResponse) {
      await cleanupThread(thread, "Ticket record creation failed");
      await interaction.editReply({
        content: messages.ticket.recordFailed,
      }).catch(() => null);
      return;
    }

    const mentions = [
      `<@${interaction.user.id}>`,
      ...category.supportRoleIds.map((roleId) => `<@&${roleId}>`),
    ].join(" ");

    const starter = await thread.send({
      content: mentions,
      embeds: [
        buildTicketThreadEmbed({
          language: categoryContext.config.defaultLanguage,
          category,
          ticket: {
            ticketNumber: recordResponse.ticket.ticketNumber,
            categoryLabel: recordResponse.ticket.categoryLabel,
            creatorId: interaction.user.id,
          },
          answers: answers.map((answer) => ({
            label: answer.label,
            value: answer.value,
          })),
          creatorTag: interaction.user.tag,
        }),
      ],
    }).catch(async (error) => {
      logError("interaction", "Failed to send ticket starter message", {
        guildId: interaction.guildId,
        threadId: thread.id,
        userId: interaction.user.id,
        error,
      });
      await reportClanDiscordError({
        client,
        guildId: interaction.guildId!,
        error,
        action: "Send the first ticket message",
        location: "Ticket system",
        scope: "interaction",
        target: thread.name,
        details: {
          threadId: thread.id,
          user: interaction.user.tag,
        },
      });
      return null;
    });
    if (!starter) {
      const ticketUrl = `https://discord.com/channels/${interaction.guildId}/${thread.id}`;
      await interaction.editReply({
        content: formatTemplate(messages.ticket.introFailed, { url: ticketUrl }),
      }).catch(() => null);
      return;
    }

    await convex.mutation(references.updateTicketTranscriptMessage, {
      secret: env.internalSecret,
      threadId: thread.id,
      transcriptMessageId: starter.id,
    }).catch((error) => {
      logWarn("interaction", "Failed to store ticket transcript message id", {
        guildId: interaction.guildId,
        threadId: thread.id,
        messageId: starter.id,
        error,
      });
      return null;
    });

    await thread.setName(`${slugifyTicketLabel(recordResponse.ticket.categoryLabel)}-${recordResponse.ticket.ticketNumber}`.slice(0, 100)).catch((error) => {
      logWarn("interaction", "Failed to rename ticket thread", {
        guildId: interaction.guildId,
        threadId: thread.id,
        error,
      });
      void reportClanDiscordError({
        client,
        guildId: interaction.guildId!,
        error,
        action: "Rename a ticket thread",
        location: "Ticket system",
        scope: "interaction",
        target: thread.name,
        details: {
          threadId: thread.id,
        },
      });
      return null;
    });

    const ticketUrl = `https://discord.com/channels/${interaction.guildId}/${thread.id}`;
    await interaction.editReply({
      content: formatTemplate(messages.ticket.created, { url: ticketUrl }),
    });
  }

  async function createDiscordMembershipApplication(
    interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
    category: MembershipCategory,
    answers: MembershipAnswer[],
  ) {
    const fallbackMessages = getClanDiscordMessages("en");
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: fallbackMessages.membership.serverOnly, flags: MessageFlags.Ephemeral });
      return;
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const categoryContext = await loadMembershipCategoryContext(interaction.guildId, category.id);
    const membershipSettings = categoryContext?.config.membershipSettings;
    const messages = getClanDiscordMessages(categoryContext?.config.defaultLanguage);
    if (!categoryContext || !membershipSettings?.applicationParentChannelId) {
      await interaction.editReply({ content: messages.membership.setupIncomplete });
      return;
    }

    const existingAssignment = await convex.query(references.getAssignmentForServerUser, {
      serverDiscordId: interaction.guildId,
      userId: interaction.user.id,
    }) as { id: string } | null;
    if (existingAssignment) {
      await interaction.editReply({ content: messages.membership.alreadyAssigned });
      return;
    }

    const parentChannel = await interaction.guild.channels.fetch(membershipSettings.applicationParentChannelId).catch(() => null);
    if (!parentChannel || parentChannel.type !== ChannelType.GuildText) {
      await interaction.editReply({ content: messages.membership.parentChannelNotText });
      return;
    }

    const initialStatus = category.assignmentType === "member" && membershipSettings.autoAssignRecruitOnApply ? "recruit" : "pending";

    const assignmentId = await convex.mutation(references.upsertAssignment, {
      secret: env.internalSecret,
      serverDiscordId: interaction.guildId,
      userId: interaction.user.id,
      type: category.assignmentType,
      status: initialStatus,
      membershipCategoryId: category.id,
      primaryGroupId: undefined,
      secondaryGroupIds: [],
      paused: false,
      pausedNote: undefined,
    }).catch(async (error) => {
      logError("interaction", "Failed to create membership assignment before application thread", {
        guildId: interaction.guildId,
        userId: interaction.user.id,
        categoryId: category.id,
        error,
      });
      await interaction.editReply({
        content: messages.membership.createAssignmentFailed,
      }).catch(() => null);
      return null;
    }) as string | null;
    if (!assignmentId) {
      return;
    }

    await revalidateAppData({
      type: "assignment-changed",
      serverId: interaction.guildId,
      userId: interaction.user.id,
      assignmentId,
    });

    await syncMembershipRoles(
      interaction.guild,
      interaction.user.id,
      categoryContext.config,
      undefined,
      undefined,
      undefined,
      category.assignmentType,
      initialStatus,
      category.id,
    );
    await interaction.guild.members.fetch().catch(() => null);

    const thread = await (parentChannel as TextChannel).threads.create({
      name: `${slugifyTicketLabel(category.label?.trim() || category.id)}-pending`.slice(0, 100),
      autoArchiveDuration: 10080,
      type: ChannelType.PrivateThread,
      invitable: false,
      reason: `Application ${category.id} opened by ${interaction.user.tag}`,
    }).catch(async (error) => {
      logError("interaction", "Failed to create membership application thread", {
        guildId: interaction.guildId,
        userId: interaction.user.id,
        categoryId: category.id,
        error,
      });
      await reportClanDiscordError({
        client,
        guildId: interaction.guildId!,
        error,
        action: "Create a membership application thread",
        location: "Membership applications",
        scope: "interaction",
        target: category.label?.trim() || category.id,
        details: {
          user: interaction.user.tag,
          categoryId: category.id,
        },
      });
      await rollbackMembershipApplicationSetup({
        guild: interaction.guild!,
        userId: interaction.user.id,
        config: categoryContext.config,
        assignmentId,
        assignmentType: category.assignmentType,
        assignmentStatus: initialStatus,
        membershipCategoryId: category.id,
      });
      await interaction.editReply({
        content: messages.membership.createThreadFailed,
      }).catch(() => null);
      return null;
    });
    if (!thread) {
      return;
    }

    const supportMemberIds = resolveSupportMemberIds(interaction.guild, category.supportRoleIds, categoryContext.config.dashboardAdminRoleId);
    const participantIds = [...new Set([interaction.user.id, ...supportMemberIds])];
    for (const memberId of participantIds) {
      await thread.members.add(memberId).catch((error) => {
        logWarn("interaction", "Failed to add membership application thread member", {
          guildId: interaction.guildId,
          threadId: thread.id,
          memberId,
          error,
        });
        void reportClanDiscordError({
          client,
          guildId: interaction.guildId!,
          error,
          action: "Add a participant to a membership application thread",
          location: "Membership applications",
          scope: "interaction",
          target: thread.name,
          details: {
            threadId: thread.id,
            memberId,
          },
        });
        return null;
      });
    }

    const recordResponse = await convex.mutation(references.createMembershipApplicationThread, {
      secret: env.internalSecret,
      guildId: interaction.guildId,
      threadId: thread.id,
      parentChannelId: parentChannel.id,
      creatorId: interaction.user.id,
      categoryId: category.id,
      assignmentType: category.assignmentType,
      assignmentId: assignmentId as never,
      answers,
    }).catch(async (error) => {
      logError("interaction", "Failed to create membership application thread record", {
        guildId: interaction.guildId,
        threadId: thread.id,
        userId: interaction.user.id,
        categoryId: category.id,
        assignmentId,
        error,
      });
      return null;
    }) as {
      application: Pick<MembershipApplicationThreadRecord, "applicationNumber" | "categoryLabel" | "threadId">;
    } | null;
    if (!recordResponse) {
      await cleanupThread(thread, "Membership application record creation failed");
      await rollbackMembershipApplicationSetup({
        guild: interaction.guild!,
        userId: interaction.user.id,
        config: categoryContext.config,
        assignmentId,
        assignmentType: category.assignmentType,
        assignmentStatus: initialStatus,
        membershipCategoryId: category.id,
      });
      await interaction.editReply({
        content: messages.membership.recordFailed,
      }).catch(() => null);
      return;
    }

    const mentions = [
      `<@${interaction.user.id}>`,
      ...category.supportRoleIds.map((roleId) => `<@&${roleId}>`),
    ].join(" ");

    const starter = await thread.send({
      content: mentions,
      embeds: [
        buildMembershipApplicationThreadEmbed({
          language: categoryContext.config.defaultLanguage,
          category,
          application: {
            applicationNumber: recordResponse.application.applicationNumber,
            categoryLabel: recordResponse.application.categoryLabel,
            creatorId: interaction.user.id,
            assignmentType: category.assignmentType,
          },
          answers: answers.map((answer) => ({
            label: answer.label,
            value: answer.value,
          })),
          creatorTag: interaction.user.tag,
          assignmentStatus: initialStatus,
        }),
      ],
    }).catch(async (error) => {
      logError("interaction", "Failed to send membership application starter message", {
        guildId: interaction.guildId,
        threadId: thread.id,
        userId: interaction.user.id,
        error,
      });
      await reportClanDiscordError({
        client,
        guildId: interaction.guildId!,
        error,
        action: "Send the first membership application message",
        location: "Membership applications",
        scope: "interaction",
        target: thread.name,
        details: {
          threadId: thread.id,
          user: interaction.user.tag,
        },
      });
      return null;
    });
    if (!starter) {
      const threadUrl = `https://discord.com/channels/${interaction.guildId}/${thread.id}`;
      await interaction.editReply({
        content: formatTemplate(messages.membership.introFailed, { url: threadUrl }),
      }).catch(() => null);
      return;
    }

    await convex.mutation(references.updateMembershipApplicationTranscriptMessage, {
      secret: env.internalSecret,
      threadId: thread.id,
      transcriptMessageId: starter.id,
    }).catch((error) => {
      logWarn("interaction", "Failed to store membership application transcript message id", {
        guildId: interaction.guildId,
        threadId: thread.id,
        messageId: starter.id,
        error,
      });
      return null;
    });

    await thread.setName(`${slugifyTicketLabel(recordResponse.application.categoryLabel)}-${recordResponse.application.applicationNumber}`.slice(0, 100)).catch((error) => {
      logWarn("interaction", "Failed to rename membership application thread", {
        guildId: interaction.guildId,
        threadId: thread.id,
        error,
      });
      void reportClanDiscordError({
        client,
        guildId: interaction.guildId!,
        error,
        action: "Rename a membership application thread",
        location: "Membership applications",
        scope: "interaction",
        target: thread.name,
        details: {
          threadId: thread.id,
        },
      });
      return null;
    });

    const threadUrl = `https://discord.com/channels/${interaction.guildId}/${thread.id}`;
    await interaction.editReply({
      content: formatTemplate(messages.membership.created, { url: threadUrl }),
    });
  }

  async function handleCloseTicketCommand(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild() || !interaction.channel?.isThread() || !interaction.guildId) {
      await interaction.reply({ content: getClanDiscordMessages("en").ticket.closeCommandThreadOnly, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildName = interaction.guild?.name ?? "this server";

    const context = await convex.query(references.getTicketThreadContext, {
      secret: env.internalSecret,
      threadId: interaction.channelId,
    }) as {
      config: EventInteractionContext["config"];
      ticket: TicketThreadRecord;
      category: TicketCategory | null;
    } | null;
    const messages = getClanDiscordMessages(context?.config.defaultLanguage);

    if (!context) {
      await interaction.editReply({ content: messages.ticket.notTracked });
      return;
    }

    if (context.ticket.status === "closed") {
      await interaction.editReply({ content: messages.ticket.alreadyClosed });
      return;
    }

    const member = interaction.member as GuildMember | null;
    if (!member) {
      await interaction.editReply({ content: messages.ticket.unableToVerifyPermissions });
      return;
    }

    const roleIds = [...member.roles.cache.keys()];
    const supportRoleIds = context.category?.supportRoleIds ?? [];
    const canClose =
      member.permissions.has("Administrator") ||
      (context.config.dashboardAdminRoleId ? roleIds.includes(context.config.dashboardAdminRoleId) : false) ||
      supportRoleIds.some((roleId) => roleIds.includes(roleId));

    if (!canClose) {
      await interaction.editReply({ content: messages.ticket.noClosePermission });
      return;
    }

    const reason = interaction.options.getString("reason")?.trim() || undefined;
    const closedAt = new Date();

    await convex.mutation(references.closeTicketThread, {
      secret: env.internalSecret,
      threadId: interaction.channelId,
      closedByUserId: interaction.user.id,
      closeReason: reason,
    });

    const creator = await interaction.client.users.fetch(context.ticket.creatorId).catch(() => null);
    if (creator) {
      const dmLines = [
        formatTemplate(messages.ticket.closeDmClosed, {
          number: String(context.ticket.ticketNumber),
          guildName,
        }),
        reason ? `${messages.ticket.reasonLabel}: ${reason}` : messages.ticket.noCloseReasonProvided,
      ];
      await creator.send({ content: dmLines.join("\n") }).catch(() => null);
    }

    await interaction.channel.send({
      embeds: [buildTicketCloseEmbed({
        messages,
        ticketNumber: context.ticket.ticketNumber,
        closerId: interaction.user.id,
        closedAt,
        reason,
      })],
    }).catch(() => null);

    await interaction.channel.setName(`closed-${context.ticket.ticketNumber}`.slice(0, 100)).catch(() => null);
    await interaction.channel.setLocked(true, reason ?? messages.ticket.closeAuditReason).catch(() => null);
    await interaction.channel.setArchived(true, reason ?? messages.ticket.closeAuditReason).catch(() => null);

    await interaction.editReply({
      content: reason
        ? formatTemplate(messages.ticket.closeReplyWithReason, { reason })
        : messages.ticket.closeReply,
    });
  }

  async function handleCloseApplicationCommand(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild() || !interaction.channel?.isThread() || !interaction.guildId) {
      await interaction.reply({ content: getClanDiscordMessages("en").membership.closeCommandThreadOnly, flags: MessageFlags.Ephemeral });
      return;
    }

    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: getClanDiscordMessages("en").membership.guildUnavailable, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const context = await convex.query(references.getMembershipApplicationThreadContext, {
      secret: env.internalSecret,
      threadId: interaction.channelId,
    }) as {
      config: EventInteractionContext["config"];
      application: MembershipApplicationThreadRecord;
      assignment: { id?: string; type: "member" | "mercenary"; status: "pending" | "recruit" | "active"; membershipCategoryId?: string } | null;
      category: MembershipCategory | null;
    } | null;
    const messages = getClanDiscordMessages(context?.config.defaultLanguage);

    if (!context) {
      await interaction.editReply({ content: messages.membership.notTracked });
      return;
    }

    if (context.application.status === "closed") {
      await interaction.editReply({ content: messages.membership.alreadyClosed });
      return;
    }

    const member = interaction.member as GuildMember | null;
    if (!member) {
      await interaction.editReply({ content: messages.membership.unableToVerifyPermissions });
      return;
    }

    const roleIds = [...member.roles.cache.keys()];
    const supportRoleIds = context.category?.supportRoleIds ?? [];
    const canClose =
      member.permissions.has("Administrator") ||
      (context.config.dashboardAdminRoleId ? roleIds.includes(context.config.dashboardAdminRoleId) : false) ||
      supportRoleIds.some((roleId) => roleIds.includes(roleId));

    if (!canClose) {
      await interaction.editReply({ content: messages.membership.noClosePermission });
      return;
    }

    const outcome = interaction.options.getString("outcome", true) as "denied" | "pending" | "recruit" | "member" | "mercenary";
    const outcomeLabel = getOutcomeLabel(context.config.defaultLanguage, outcome);
    const reason = interaction.options.getString("reason")?.trim() || undefined;
    const closedAt = new Date();

    if (outcome === "denied") {
      if (context.application.assignmentId) {
        await convex.mutation(references.removeAssignment, {
          secret: env.internalSecret,
          assignmentId: context.application.assignmentId as never,
        }).catch(() => null);
        await revalidateAppData({
          type: "assignment-changed",
          serverId: interaction.guildId,
          userId: context.application.creatorId,
          assignmentId: context.application.assignmentId,
        });
      }
      await syncMembershipRoles(
        guild,
        context.application.creatorId,
        context.config,
        context.assignment?.type,
        context.assignment?.status,
        context.assignment?.membershipCategoryId ?? context.application.categoryId,
        undefined,
        undefined,
        undefined,
      );
    } else {
      const nextType = outcome === "mercenary" ? "mercenary" : "member";
      const nextStatus = outcome === "pending" ? "pending" : outcome === "recruit" ? "recruit" : "active";
      const nextCategoryId = context.assignment?.membershipCategoryId ?? context.application.categoryId;
      const assignmentId = await convex.mutation(references.upsertAssignment, {
        secret: env.internalSecret,
        serverDiscordId: interaction.guildId,
        assignmentId: context.application.assignmentId as never,
        userId: context.application.creatorId,
        type: nextType,
        status: nextStatus,
        membershipCategoryId: nextCategoryId,
        primaryGroupId: undefined,
        secondaryGroupIds: [],
        paused: false,
        pausedNote: undefined,
      }) as string;
      await revalidateAppData({
        type: "assignment-changed",
        serverId: interaction.guildId,
        userId: context.application.creatorId,
        assignmentId,
      });
      await syncMembershipRoles(
        guild,
        context.application.creatorId,
        context.config,
        context.assignment?.type,
        context.assignment?.status,
        context.assignment?.membershipCategoryId ?? context.application.categoryId,
        nextType,
        nextStatus,
        nextCategoryId,
      );
    }

    await convex.mutation(references.closeMembershipApplicationThread, {
      secret: env.internalSecret,
      threadId: interaction.channelId,
      closedByUserId: interaction.user.id,
      closeReason: reason,
      closeOutcome: outcome,
    });

    const creator = await interaction.client.users.fetch(context.application.creatorId).catch(() => null);
    if (creator) {
      const lines = [
        formatTemplate(messages.membership.closeDmClosed, {
          number: String(context.application.applicationNumber),
          guildName: interaction.guild?.name ?? "this server",
        }),
        `${messages.membership.outcomeLabel}: ${outcomeLabel}`,
        reason ? `${messages.membership.reasonLabel}: ${reason}` : messages.membership.noCloseReasonProvided,
      ];
      await creator.send({ content: lines.join("\n") }).catch(() => null);
    }

    await interaction.channel.send({
      embeds: [buildMembershipApplicationCloseEmbed({
        messages,
        applicationNumber: context.application.applicationNumber,
        closerId: interaction.user.id,
        closedAt,
        outcomeLabel,
        reason,
      })],
    }).catch(() => null);

    await interaction.channel.setName(`closed-${context.application.applicationNumber}`.slice(0, 100)).catch(() => null);
    await interaction.channel.setLocked(true, reason ?? messages.membership.closeAuditReason).catch(() => null);
    await interaction.channel.setArchived(true, reason ?? messages.membership.closeAuditReason).catch(() => null);
    await interaction.editReply({
      content: reason
        ? formatTemplate(messages.membership.closeReplyWithReason, { outcome: outcomeLabel, reason })
        : formatTemplate(messages.membership.closeReply, { outcome: outcomeLabel }),
    });
  }
}
