import {
  ActionRowBuilder,
  ButtonInteraction,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { getClanDiscordMessages } from "../../src/lib/clan-language";

import { SIGNUP_NOT_ATTENDING, TRAINING_ATTEND } from "./constants";
import { revalidateAppData } from "./cache";
import { convex, references } from "./convex";
import { env } from "./environment";
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

function formatTemplate(template: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.split(`{${key}}`).join(value),
    template,
  );
}

function getOutcomeLabel(language: "en" | "cs", outcome: "denied" | "pending" | "recruit" | "member" | "mercenary") {
  const messages = getClanDiscordMessages(language);
  switch (outcome) {
    case "denied":
      return messages.commands.outcomeDenied;
    case "pending":
      return messages.commands.outcomePending;
    case "recruit":
      return messages.commands.outcomeRecruit;
    case "member":
      return messages.commands.outcomeMember;
    case "mercenary":
      return messages.commands.outcomeMercenary;
  }
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
      }
    },

    async handleModalSubmit(interaction: ModalSubmitInteraction) {
      if (interaction.customId.startsWith("ticket-modal:")) {
        await handleTicketModalSubmit(interaction);
      } else if (interaction.customId.startsWith("membership-modal:")) {
        await handleMembershipModalSubmit(interaction);
      }
    },

    async handleChatInputCommand(interaction: ChatInputCommandInteraction) {
      if (interaction.commandName === "close_ticket") {
        await handleCloseTicketCommand(interaction);
      } else if (interaction.commandName === "close_application") {
        await handleCloseApplicationCommand(interaction);
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
    const prereq = await convex.query(references.getMembershipApplicationPrereq, {
      secret: env.internalSecret,
      guildId: interaction.guildId,
      categoryId,
      userId: interaction.user.id,
    }) as {
      config: EventInteractionContext["config"];
      category: MembershipCategory;
      user: { platformIds?: string[] } | null;
      assignment: { id: string; membershipCategoryId?: string } | null;
      hasOpenApplication: boolean;
    } | null;
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
      const tokenResponse = await convex.mutation(references.createPlatformIdLinkToken, {
        secret: env.internalSecret,
        guildId: interaction.guildId,
        categoryId,
        userId: interaction.user.id,
        userName: interaction.user.globalName ?? interaction.user.username,
        userAvatar: interaction.user.displayAvatarURL(),
      }) as { token: string };
      const link = `${env.appSiteUrl}/${prereq.config.defaultLanguage}/platform-id-link/${tokenResponse.token}`;
      const dmSent = await sendPlatformIdDm(interaction, link, prereq.config.defaultLanguage);
      const responseText = dmSent
        ? messages.membership.dmSent
        : formatTemplate(messages.membership.dmFailed, { link });
      await interaction.reply({ content: responseText, flags: MessageFlags.Ephemeral });
      return;
    }

    if (prereq.category.modalQuestions.length) {
      const modal = new ModalBuilder()
        .setCustomId(`membership-modal:${categoryId}`)
        .setTitle((prereq.category.label?.trim() || messages.membership.modalTitle).slice(0, 45));

      for (const question of prereq.category.modalQuestions.slice(0, 5)) {
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

    await createDiscordMembershipApplication(interaction, prereq.category, []);
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
      return null;
    });

    const ticketUrl = `https://discord.com/channels/${interaction.guildId}/${thread.id}`;
    await interaction.editReply({
      content: formatTemplate(messages.ticket.created, { url: ticketUrl }),
    });
  }

  async function createDiscordMembershipApplication(
    interaction: ButtonInteraction | ModalSubmitInteraction,
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

async function handleEventButtonInteraction(interaction: ButtonInteraction, options: InteractionHandlerOptions) {
  const [, eventId, encodedGroupId] = interaction.customId.split(":");
  const groupId = decodeURIComponent(encodedGroupId ?? "");

  if (interaction.customId.startsWith("attendance:")) {
    const context = (await convex.query(references.getEventInteractionContext, {
      secret: env.internalSecret,
      eventId: eventId as never,
    })) as EventInteractionContext | null;

    if (!context) {
      await interaction.reply({ content: getClanDiscordMessages("en").interaction.unableToLoadEventContext, ephemeral: true });
      return;
    }

    await handleAttendanceInteraction(interaction, context, options);
    return;
  }

  if (!interaction.guildId) {
    await interaction.reply({ content: getClanDiscordMessages("en").interaction.signupServerOnly, ephemeral: true });
    return;
  }

  const context = (await convex.query(references.getEventSignupContext, {
    secret: env.internalSecret,
    guildId: interaction.guildId,
    eventId: eventId as never,
  })) as EventInteractionContext | null;

  if (!context) {
    await interaction.reply({ content: getClanDiscordMessages("en").interaction.unableToLoadEventContext, ephemeral: true });
    return;
  }

  if (!isSignupOpen(context.event)) {
    await interaction.reply({
      content: getClanDiscordMessages(context.config.defaultLanguage).interaction.registrationClosed,
      ephemeral: true,
    });
    return;
  }

  const member = interaction.member as GuildMember | null;
  const isTrainingAttend = context.event.kind === "training" && groupId === TRAINING_ATTEND;
  const selectedGroup =
    groupId === SIGNUP_NOT_ATTENDING || isTrainingAttend
      ? null
      : context.groups.find((group) => group.id === groupId);

  if (!selectedGroup && groupId !== SIGNUP_NOT_ATTENDING && !isTrainingAttend) {
    await interaction.reply({
      content: getClanDiscordMessages(context.config.defaultLanguage).interaction.invalidSignupButton,
      ephemeral: true,
    });
    return;
  }
  if (!member) {
    await interaction.reply({
      content: getClanDiscordMessages(context.config.defaultLanguage).interaction.unableToResolveMembership,
      ephemeral: true,
    });
    return;
  }
  if (
    context.event.requiredRoleIds.length > 0 &&
    !context.event.requiredRoleIds.some((roleId) => member.roles.cache.has(roleId))
  ) {
    await interaction.reply({
      content: getClanDiscordMessages(context.config.defaultLanguage).interaction.missingRequiredRole,
      ephemeral: true,
    });
    return;
  }
  if (selectedGroup && selectedGroup.discordRoleId && !member.roles.cache.has(selectedGroup.discordRoleId)) {
    await interaction.reply({
      content: getClanDiscordMessages(context.config.defaultLanguage).interaction.missingRequiredRole,
      ephemeral: true,
    });
    return;
  }

  await convex.mutation(references.toggleSignUp, {
    secret: env.internalSecret,
    eventId: eventId as never,
    userId: interaction.user.id,
    group: isTrainingAttend ? TRAINING_ATTEND : (selectedGroup ? selectedGroup.name : SIGNUP_NOT_ATTENDING),
  });
  await revalidateAppData({
    type: "event-changed",
    serverId: context.event.guildId,
    eventId,
  });

  options.enqueueEventSync(eventId);
  options.triggerPollSoon();
  logInfo("interaction", "Queued event sync after signup change", {
    eventId,
    userId: interaction.user.id,
    guildId: interaction.guildId,
  });

  await interaction.reply({
    content:
      selectedGroup || isTrainingAttend
        ? getClanDiscordMessages(context.config.defaultLanguage).interaction.signupUpdated
        : getClanDiscordMessages(context.config.defaultLanguage).interaction.markedNotAttending,
    ephemeral: true,
  });
}

async function loadTicketCategoryContext(guildId: string, categoryId: string) {
  return await convex.query(references.getTicketCategoryContext, {
    secret: env.internalSecret,
    guildId,
    categoryId,
  }) as {
    config: EventInteractionContext["config"];
    category: TicketCategory;
  } | null;
}

async function loadMembershipCategoryContext(guildId: string, categoryId: string) {
  return await convex.query(references.getMembershipCategoryContext, {
    secret: env.internalSecret,
    guildId,
    categoryId,
  }) as {
    config: EventInteractionContext["config"];
    category: MembershipCategory;
  } | null;
}

function resolveSupportMemberIds(guild: import("discord.js").Guild, supportRoleIds: string[], dashboardAdminRoleId?: string) {
  const memberIds = new Set<string>();

  for (const member of guild.members.cache.values()) {
    const roleIds = [...member.roles.cache.keys()];
    if (
      member.permissions.has("Administrator") ||
      (dashboardAdminRoleId ? roleIds.includes(dashboardAdminRoleId) : false) ||
      supportRoleIds.some((roleId) => roleIds.includes(roleId))
    ) {
      memberIds.add(member.id);
    }
  }

  return [...memberIds];
}

async function sendPlatformIdDm(interaction: ButtonInteraction, link: string, language: "en" | "cs") {
  try {
    const messages = getClanDiscordMessages(language);
    const dm = await interaction.user.createDM();
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setURL(link)
        .setLabel(messages.membership.platformIdButton),
    );
    await dm.send({
      content: [
        messages.membership.platformIdDmIntro,
        messages.membership.platformIdDmInstruction,
      ].join("\n\n"),
      components: [row],
    });
    return true;
  } catch (error) {
    logWarn("interaction", "Failed to DM platform ID link", {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      error,
    });
    return false;
  }
}

async function syncMembershipRoles(
  guild: import("discord.js").Guild,
  userId: string,
  config: EventInteractionContext["config"],
  beforeType?: "member" | "mercenary",
  beforeStatus?: "pending" | "recruit" | "active",
  beforeCategoryId?: string,
  afterType?: "member" | "mercenary",
  afterStatus?: "pending" | "recruit" | "active",
  afterCategoryId?: string,
) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) {
    logWarn("interaction", "Skipping membership role sync because member could not be fetched", {
      guildId: guild.id,
      userId,
    });
    return;
  }

  const beforeRoles = new Set(resolveMembershipRoleIds(config, beforeType, beforeStatus, beforeCategoryId));
  const afterRoles = new Set(resolveMembershipRoleIds(config, afterType, afterStatus, afterCategoryId));

  for (const roleId of afterRoles) {
    if (!beforeRoles.has(roleId)) {
      await member.roles.add(roleId).catch((error) => {
        logWarn("interaction", "Failed to add membership role", {
          guildId: guild.id,
          userId,
          roleId,
          error,
        });
        return null;
      });
    }
  }

  for (const roleId of beforeRoles) {
    if (!afterRoles.has(roleId)) {
      await member.roles.remove(roleId).catch((error) => {
        logWarn("interaction", "Failed to remove membership role", {
          guildId: guild.id,
          userId,
          roleId,
          error,
        });
        return null;
      });
    }
  }
}

async function cleanupThread(thread: import("discord.js").ThreadChannel, reason: string) {
  await thread.delete(reason).catch(async (error) => {
    logWarn("interaction", "Failed to delete thread during cleanup", {
      threadId: thread.id,
      reason,
      error,
    });
    await thread.setLocked(true, reason).catch(() => null);
    await thread.setArchived(true, reason).catch(() => null);
    return null;
  });
}

async function rollbackMembershipApplicationSetup(input: {
  guild: import("discord.js").Guild;
  userId: string;
  config: EventInteractionContext["config"];
  assignmentId: string;
  assignmentType: "member" | "mercenary";
  assignmentStatus: "pending" | "recruit" | "active";
  membershipCategoryId: string;
}) {
  const { guild, userId, config, assignmentId, assignmentType, assignmentStatus, membershipCategoryId } = input;
  await convex.mutation(references.removeAssignment, {
    secret: env.internalSecret,
    assignmentId: assignmentId as never,
  }).catch((error) => {
    logWarn("interaction", "Failed to roll back membership assignment", {
      guildId: guild.id,
      userId,
      assignmentId,
      error,
    });
    return null;
  });

  await revalidateAppData({
    type: "assignment-changed",
    serverId: guild.id,
    userId,
    assignmentId,
  });

  await syncMembershipRoles(
    guild,
    userId,
    config,
    assignmentType,
    assignmentStatus,
    membershipCategoryId,
    undefined,
    undefined,
    undefined,
  );
}

function resolveMembershipRoleIds(
  config: EventInteractionContext["config"],
  type?: "member" | "mercenary",
  status?: "pending" | "recruit" | "active",
  membershipCategoryId?: string,
) {
  if (!type || !status) {
    return [];
  }

  if (status === "pending") {
    return [];
  }

  const roleIds = new Set<string>();
  const category = membershipCategoryId
    ? config.membershipSettings?.categories.find((item) => item.id === membershipCategoryId)
    : undefined;
  if (config.clanRoleId) {
    roleIds.add(config.clanRoleId);
  }
  if (status === "recruit" && category?.recruitRoleId) {
    roleIds.add(category.recruitRoleId);
  }
  if (status === "active" && category?.finalRoleId) {
    roleIds.add(category.finalRoleId);
  }

  return [...roleIds];
}

function isSignupOpen(event: EventInteractionContext["event"]) {
  if (event.status === "registration") {
    return true;
  }

  if (event.kind !== "training" || event.status !== "starting") {
    return false;
  }

  const registrationEnd = new Date(event.registrationEnd).getTime();
  return Number.isFinite(registrationEnd) && Date.now() < registrationEnd;
}

async function handleAttendanceInteraction(
  interaction: ButtonInteraction,
  context: EventInteractionContext,
  options: InteractionHandlerOptions,
) {
  const replyOptions = { ephemeral: Boolean(interaction.guildId) };
  const messages = getClanDiscordMessages(context.config.defaultLanguage);

  if (context.event.status !== "starting") {
    await interaction.reply({ content: messages.interaction.attendanceNotOpen, ...replyOptions });
    return;
  }
  if (!context.roster?.published) {
    await interaction.reply({ content: messages.interaction.rosterNotPublished, ...replyOptions });
    return;
  }

  const isOnRoster = context.roster.squads.some((squad) =>
    squad.players.some((player) => player.id === interaction.user.id),
  );
  if (!isOnRoster) {
    await interaction.reply({ content: messages.interaction.notOnRoster, ...replyOptions });
    return;
  }

  await convex.mutation(references.acknowledgeAttendance, {
    eventId: context.event.id as never,
    userId: interaction.user.id,
  });
  if (context.roster) {
    await revalidateAppData({
      type: "roster-changed",
      serverId: context.event.guildId,
      rosterId: context.roster.id,
      eventId: context.event.id,
    });
  } else {
    await revalidateAppData({
      type: "event-changed",
      serverId: context.event.guildId,
      eventId: context.event.id,
    });
  }

  options.enqueueEventSync(context.event.id);
  options.triggerPollSoon();
  logInfo("interaction", "Queued event sync after attendance acknowledgement", {
    eventId: context.event.id,
    userId: interaction.user.id,
    guildId: interaction.guildId,
  });

  await interaction.reply({ content: messages.interaction.attendanceAcknowledged, ...replyOptions });
}
