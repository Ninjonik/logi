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
import { convex, references } from "./convex";
import { env } from "./environment";
import { buildMembershipApplicationThreadEmbed, buildTicketThreadEmbed } from "./message-builders";
import type { EventInteractionContext, MembershipApplicationThreadRecord, MembershipCategory, TicketCategory, TicketThreadRecord } from "./types";
import { revalidateRosterImage, slugifyTicketLabel } from "./utils";

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

export function createInteractionHandler(options: InteractionHandlerOptions) {
  const { enqueueEventSync, triggerPollSoon } = options;

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
      const commands = [
        new SlashCommandBuilder()
          .setName("close_ticket")
          .setDescription("Close the current ticket thread.")
          .addStringOption((option) =>
            option
              .setName("reason")
              .setDescription("Reason shown to the ticket creator in DMs.")
              .setMaxLength(500)
              .setRequired(false),
          )
          .setDMPermission(false),
        new SlashCommandBuilder()
          .setName("close_application")
          .setDescription("Close the current membership application thread.")
          .addStringOption((option) =>
            option
              .setName("outcome")
              .setDescription("What the applicant should become after closing.")
              .setRequired(true)
              .addChoices(
                { name: "Denied", value: "denied" },
                { name: "Pending", value: "pending" },
                { name: "Recruit", value: "recruit" },
                { name: "Member", value: "member" },
                { name: "Mercenary", value: "mercenary" },
              ),
          )
          .addStringOption((option) =>
            option
              .setName("reason")
              .setDescription("Reason shown to the applicant in DMs.")
              .setMaxLength(500)
              .setRequired(false),
          )
          .setDMPermission(false),
      ];

      await guild.commands.set(commands.map((command) => command.toJSON()));
    },
  };

  async function handleTicketButtonInteraction(interaction: ButtonInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: "Tickets can only be opened inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const categoryId = interaction.customId.replace("ticket:", "");
    const context = await loadTicketCategoryContext(interaction.guildId, categoryId);
    if (!context?.config.ticketSettings?.enabled) {
      await interaction.reply({ content: "Ticket setup is not available right now.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (context.category.modalQuestions.length) {
      const modal = new ModalBuilder()
        .setCustomId(`ticket-modal:${categoryId}`)
        .setTitle((context.category.label?.trim() || "Ticket details").slice(0, 45));

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
    if (!interaction.guildId) {
      await interaction.reply({ content: "Tickets can only be opened inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const categoryId = interaction.customId.replace("ticket-modal:", "");
    const context = await loadTicketCategoryContext(interaction.guildId, categoryId);
    if (!context?.config.ticketSettings?.enabled) {
      await interaction.reply({ content: "Ticket setup is not available right now.", flags: MessageFlags.Ephemeral });
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
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: "Applications can only be opened inside a server.", flags: MessageFlags.Ephemeral });
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

    if (!prereq?.config.membershipSettings?.enabled) {
      await interaction.reply({ content: "Membership applications are not available right now.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (prereq.assignment) {
      await interaction.reply({ content: "You are already added to this clan. Ask staff if your membership status needs to be changed.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (prereq.hasOpenApplication) {
      await interaction.reply({ content: "You already have an open clan application. Wait for staff to close it before opening another.", flags: MessageFlags.Ephemeral });
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
      const dmSent = await sendPlatformIdDm(interaction, link);
      const responseText = dmSent
        ? "I sent you a DM with a direct link to submit your platform ID. Submit it there, then click this button again."
        : `I could not DM you. Use this one-time link to submit your platform ID, then click the button again: ${link}`;
      await interaction.reply({ content: responseText, flags: MessageFlags.Ephemeral });
      return;
    }

    if (prereq.category.modalQuestions.length) {
      const modal = new ModalBuilder()
        .setCustomId(`membership-modal:${categoryId}`)
        .setTitle((prereq.category.label?.trim() || "Clan application").slice(0, 45));

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
    if (!interaction.guildId) {
      await interaction.reply({ content: "Applications can only be opened inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const categoryId = interaction.customId.replace("membership-modal:", "");
    const context = await loadMembershipCategoryContext(interaction.guildId, categoryId);
    if (!context?.config.membershipSettings?.enabled) {
      await interaction.reply({ content: "Membership applications are not available right now.", flags: MessageFlags.Ephemeral });
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
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: "Tickets can only be opened inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const categoryContext = await loadTicketCategoryContext(interaction.guildId, category.id);
    const ticketSettings = categoryContext?.config.ticketSettings;
    if (!categoryContext || !ticketSettings?.ticketParentChannelId) {
      await interaction.editReply({ content: "Ticket setup is incomplete." });
      return;
    }

    const parentChannel = await interaction.guild.channels.fetch(ticketSettings.ticketParentChannelId).catch(() => null);
    if (!parentChannel || parentChannel.type !== ChannelType.GuildText) {
      await interaction.editReply({ content: "Ticket parent channel is not a text channel." });
      return;
    }

    await interaction.guild.members.fetch().catch(() => null);

    const thread = await (parentChannel as TextChannel).threads.create({
      name: `${slugifyTicketLabel(category.label?.trim() || category.id)}-pending`.slice(0, 100),
      autoArchiveDuration: 10080,
      type: ChannelType.PrivateThread,
      invitable: false,
      reason: `Ticket ${category.id} opened by ${interaction.user.tag}`,
    });

    const supportMemberIds = resolveSupportMemberIds(interaction.guild, category.supportRoleIds, categoryContext.config.dashboardAdminRoleId);
    const participantIds = [...new Set([interaction.user.id, ...supportMemberIds])];

    for (const memberId of participantIds) {
      await thread.members.add(memberId).catch(() => null);
    }

    const recordResponse = await convex.mutation(references.createTicketThread, {
      secret: env.internalSecret,
      guildId: interaction.guildId,
      threadId: thread.id,
      parentChannelId: parentChannel.id,
      creatorId: interaction.user.id,
      categoryId: category.id,
      answers,
    }) as {
      ticket: Pick<TicketThreadRecord, "ticketNumber" | "categoryLabel" | "threadId">;
      category: TicketCategory;
    };

    const mentions = [
      `<@${interaction.user.id}>`,
      ...category.supportRoleIds.map((roleId) => `<@&${roleId}>`),
    ].join(" ");

    const starter = await thread.send({
      content: mentions,
      embeds: [
        buildTicketThreadEmbed({
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
    });

    await convex.mutation(references.updateTicketTranscriptMessage, {
      secret: env.internalSecret,
      threadId: thread.id,
      transcriptMessageId: starter.id,
    }).catch(() => null);

    await thread.setName(`${slugifyTicketLabel(recordResponse.ticket.categoryLabel)}-${recordResponse.ticket.ticketNumber}`.slice(0, 100)).catch(() => null);

    const ticketUrl = `https://discord.com/channels/${interaction.guildId}/${thread.id}`;
    await interaction.editReply({
      content: `Your ticket has been created: ${ticketUrl}`,
    });
  }

  async function createDiscordMembershipApplication(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    category: MembershipCategory,
    answers: MembershipAnswer[],
  ) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: "Applications can only be opened inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const categoryContext = await loadMembershipCategoryContext(interaction.guildId, category.id);
    const membershipSettings = categoryContext?.config.membershipSettings;
    if (!categoryContext || !membershipSettings?.applicationParentChannelId) {
      await interaction.editReply({ content: "Membership application setup is incomplete." });
      return;
    }

    const existingAssignment = await convex.query(references.getAssignmentForServerUser, {
      serverDiscordId: interaction.guildId,
      userId: interaction.user.id,
    }) as { id: string } | null;
    if (existingAssignment) {
      await interaction.editReply({ content: "You are already assigned to this clan." });
      return;
    }

    const parentChannel = await interaction.guild.channels.fetch(membershipSettings.applicationParentChannelId).catch(() => null);
    if (!parentChannel || parentChannel.type !== ChannelType.GuildText) {
      await interaction.editReply({ content: "Application parent channel is not a text channel." });
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
    }) as string;

    await syncMembershipRoles(interaction.guild, interaction.user.id, categoryContext.config, undefined, undefined, undefined, category.assignmentType, initialStatus, category.id);
    await interaction.guild.members.fetch().catch(() => null);

    const thread = await (parentChannel as TextChannel).threads.create({
      name: `${slugifyTicketLabel(category.label?.trim() || category.id)}-pending`.slice(0, 100),
      autoArchiveDuration: 10080,
      type: ChannelType.PrivateThread,
      invitable: false,
      reason: `Application ${category.id} opened by ${interaction.user.tag}`,
    });

    const supportMemberIds = resolveSupportMemberIds(interaction.guild, category.supportRoleIds, categoryContext.config.dashboardAdminRoleId);
    const participantIds = [...new Set([interaction.user.id, ...supportMemberIds])];
    for (const memberId of participantIds) {
      await thread.members.add(memberId).catch(() => null);
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
    }) as {
      application: Pick<MembershipApplicationThreadRecord, "applicationNumber" | "categoryLabel" | "threadId">;
    };

    const mentions = [
      `<@${interaction.user.id}>`,
      ...category.supportRoleIds.map((roleId) => `<@&${roleId}>`),
    ].join(" ");

    const starter = await thread.send({
      content: mentions,
      embeds: [
        buildMembershipApplicationThreadEmbed({
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
    });

    await convex.mutation(references.updateMembershipApplicationTranscriptMessage, {
      secret: env.internalSecret,
      threadId: thread.id,
      transcriptMessageId: starter.id,
    }).catch(() => null);

    await thread.setName(`${slugifyTicketLabel(recordResponse.application.categoryLabel)}-${recordResponse.application.applicationNumber}`.slice(0, 100)).catch(() => null);

    const threadUrl = `https://discord.com/channels/${interaction.guildId}/${thread.id}`;
    await interaction.editReply({
      content: `Your clan application has been created: ${threadUrl}`,
    });
  }

  async function handleCloseTicketCommand(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild() || !interaction.channel?.isThread() || !interaction.guildId) {
      await interaction.reply({ content: "Use this command inside a ticket thread.", flags: MessageFlags.Ephemeral });
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

    if (!context) {
      await interaction.editReply({ content: "This thread is not tracked as a ticket." });
      return;
    }

    if (context.ticket.status === "closed") {
      await interaction.editReply({ content: "This ticket is already closed." });
      return;
    }

    const member = interaction.member as GuildMember | null;
    if (!member) {
      await interaction.editReply({ content: "Unable to verify your permissions for this ticket." });
      return;
    }

    const roleIds = [...member.roles.cache.keys()];
    const supportRoleIds = context.category?.supportRoleIds ?? [];
    const canClose =
      member.permissions.has("Administrator") ||
      (context.config.dashboardAdminRoleId ? roleIds.includes(context.config.dashboardAdminRoleId) : false) ||
      supportRoleIds.some((roleId) => roleIds.includes(roleId));

    if (!canClose) {
      await interaction.editReply({ content: "You do not have permission to close this ticket." });
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
        `Your ticket #${context.ticket.ticketNumber} in **${guildName}** has been closed.`,
        reason ? `Reason: ${reason}` : "No close reason was provided.",
      ];
      await creator.send({ content: dmLines.join("\n") }).catch(() => null);
    }

    await interaction.channel.setName(`closed-${context.ticket.ticketNumber}`.slice(0, 100)).catch(() => null);
    await interaction.channel.setLocked(true, reason ?? "Ticket closed").catch(() => null);
    await interaction.channel.setArchived(true, reason ?? "Ticket closed").catch(() => null);

    await interaction.editReply({
      content: reason ? `Ticket closed. Reason: ${reason}` : "Ticket closed.",
    });
  }

  async function handleCloseApplicationCommand(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild() || !interaction.channel?.isThread() || !interaction.guildId) {
      await interaction.reply({ content: "Use this command inside an application thread.", flags: MessageFlags.Ephemeral });
      return;
    }

    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: "Unable to resolve the guild for this application.", flags: MessageFlags.Ephemeral });
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

    if (!context) {
      await interaction.editReply({ content: "This thread is not tracked as a membership application." });
      return;
    }

    if (context.application.status === "closed") {
      await interaction.editReply({ content: "This application is already closed." });
      return;
    }

    const member = interaction.member as GuildMember | null;
    if (!member) {
      await interaction.editReply({ content: "Unable to verify your permissions for this application." });
      return;
    }

    const roleIds = [...member.roles.cache.keys()];
    const supportRoleIds = context.category?.supportRoleIds ?? [];
    const canClose =
      member.permissions.has("Administrator") ||
      (context.config.dashboardAdminRoleId ? roleIds.includes(context.config.dashboardAdminRoleId) : false) ||
      supportRoleIds.some((roleId) => roleIds.includes(roleId));

    if (!canClose) {
      await interaction.editReply({ content: "You do not have permission to close this application." });
      return;
    }

    const outcome = interaction.options.getString("outcome", true) as "denied" | "pending" | "recruit" | "member" | "mercenary";
    const reason = interaction.options.getString("reason")?.trim() || undefined;

    if (outcome === "denied") {
      if (context.application.assignmentId) {
        await convex.mutation(references.removeAssignment, {
          secret: env.internalSecret,
          assignmentId: context.application.assignmentId as never,
        }).catch(() => null);
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
      void assignmentId;
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
        `Your clan application #${context.application.applicationNumber} in **${interaction.guild?.name ?? "this server"}** has been closed.`,
        `Outcome: ${outcome}`,
        reason ? `Reason: ${reason}` : "No close reason was provided.",
      ];
      await creator.send({ content: lines.join("\n") }).catch(() => null);
    }

    await interaction.channel.setName(`closed-${context.application.applicationNumber}`.slice(0, 100)).catch(() => null);
    await interaction.channel.setLocked(true, reason ?? "Application closed").catch(() => null);
    await interaction.channel.setArchived(true, reason ?? "Application closed").catch(() => null);
    await interaction.editReply({ content: reason ? `Application closed as ${outcome}. Reason: ${reason}` : `Application closed as ${outcome}.` });
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

  options.enqueueEventSync(eventId);
  options.triggerPollSoon();

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

async function sendPlatformIdDm(interaction: ButtonInteraction, link: string) {
  try {
    const dm = await interaction.user.createDM();
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setURL(link)
        .setLabel("Submit platform ID"),
    );
    await dm.send({
      content: [
        "Before we can continue your clan application, we need a platform ID we can match to Hell Let Loose.",
        "Use the button below to open the one-time submission page. When it says successful, close it and click the application button again in Discord.",
      ].join("\n\n"),
      components: [row],
    });
    return true;
  } catch {
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
    return;
  }

  const beforeRoles = new Set(resolveMembershipRoleIds(config, beforeType, beforeStatus, beforeCategoryId));
  const afterRoles = new Set(resolveMembershipRoleIds(config, afterType, afterStatus, afterCategoryId));

  for (const roleId of afterRoles) {
    if (!beforeRoles.has(roleId)) {
      await member.roles.add(roleId).catch(() => null);
    }
  }

  for (const roleId of beforeRoles) {
    if (!afterRoles.has(roleId)) {
      await member.roles.remove(roleId).catch(() => null);
    }
  }
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
  await revalidateRosterImage(context.event.id);

  options.enqueueEventSync(context.event.id);
  options.triggerPollSoon();

  await interaction.reply({ content: messages.interaction.attendanceAcknowledged, ...replyOptions });
}
