import { ActionRowBuilder, StringSelectMenuBuilder, type ButtonInteraction, type GuildMember, type StringSelectMenuInteraction } from "discord.js";

import { getResolvedMemberStatus } from "../../../src/domain/assignments/policy";
import { getClanDiscordMessages } from "../../../src/lib/clan-language";
import { buildEventSignupActions, formatSignupResultMessage, getSignupActionEmoji, resolveEventSignupSelection } from "../../../src/lib/event-signup";
import { revalidateAppData } from "../cache";
import { convex, references } from "../convex";
import { env } from "../environment";
import { logInfo } from "../log";
import type { EventInteractionContext } from "../types";

type InteractionHandlerOptions = {
  enqueueEventSync: (eventId: string) => void;
  triggerPollSoon: () => void;
};

export async function handleEventSignupPickerInteraction(interaction: ButtonInteraction) {
  if (!interaction.guildId) {
    await interaction.reply({ content: getClanDiscordMessages("en").interaction.signupServerOnly, ephemeral: true });
    return;
  }
  const eventId = interaction.customId.replace("signup-picker:", "");
  const context = (await convex.query(references.getEventSignupContext, {
    secret: env.internalSecret,
    guildId: interaction.guildId,
    eventId: eventId as never,
  })) as EventInteractionContext | null;
  if (!context) {
    await interaction.reply({ content: getClanDiscordMessages("en").interaction.unableToLoadEventContext, ephemeral: true });
    return;
  }
  const member = interaction.member as GuildMember | null;
  const messages = getClanDiscordMessages(context.config.defaultLanguage);
  const assignment = context.assignments?.find((item) => item.userId === interaction.user.id);
  const resolvedMembershipStatus = assignment?.type && assignment.status
    ? getResolvedMemberStatus(assignment.type, assignment.status)
    : null;
  const membershipStatus = resolvedMembershipStatus && resolvedMembershipStatus !== "pending" ? resolvedMembershipStatus : null;
  const available = buildEventSignupActions(context.event, context.groups, messages.buttons).filter((action) =>
    resolveEventSignupSelection({
      event: context.event,
      groups: context.groups,
      memberRoleIds: member ? [...member.roles.cache.keys()] : null,
      assignedGroupIds: assignment ? [assignment.primaryGroupId, ...(assignment.secondaryGroupIds ?? [])].filter((id): id is string => Boolean(id)) : [],
      membershipStatus,
      actionId: action.id,
      labels: messages.interaction,
    }).ok,
  );
  if (!available.length) {
    await interaction.reply({ content: messages.interaction.missingRequiredRole, ephemeral: true });
    return;
  }
  await interaction.reply({
    content: messages.embed.chooseSignup,
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder().setCustomId(`signup:${eventId}:select`).setPlaceholder(messages.embed.chooseSignup).addOptions(
        available.slice(0, 25).map((action) => ({
          label: action.label.slice(0, 100),
          value: action.id,
          ...(getSignupActionEmoji(action.id, available) ? { emoji: getSignupActionEmoji(action.id, available) } : {}),
        })),
      ),
    )],
    ephemeral: true,
  });
}

export async function handleRosterAssignmentInteraction(interaction: ButtonInteraction) {
  const eventId = interaction.customId.replace("roster-assignment:", "");
  const context = (await convex.query(references.getEventInteractionContext, { secret: env.internalSecret, eventId: eventId as never })) as EventInteractionContext | null;
  const messages = getClanDiscordMessages(context?.config.defaultLanguage);
  const roster = context?.roster;
  const squad = roster?.squads.find((item) => item.players.some((player) => player.id === interaction.user.id));
  const player = squad?.players.find((item) => item.id === interaction.user.id);
  const content = player && squad
    ? `**${squad.name}**${player.roleName ? ` — **${player.roleName}**` : ""}${player.note ? `\n${player.note}` : ""}`
    : roster?.reservePlayerIds.includes(interaction.user.id)
      ? messages.embed.assignmentReserve
      : messages.embed.assignmentUnassigned;
  await interaction.reply({ content, ephemeral: true });
}

const signupInteractionLocks = new Map<string, Promise<void>>();

export async function handleEventButtonInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  options: InteractionHandlerOptions,
) {
  const [, eventId, encodedGroupId] = interaction.customId.split(":");
  const groupId = interaction.isStringSelectMenu() ? (interaction.values[0] ?? "") : decodeURIComponent(encodedGroupId ?? "");

  if (interaction.isButton() && interaction.customId.startsWith("attendance:")) {
    await interaction.deferReply({ ephemeral: Boolean(interaction.guildId) });
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

  const lockKey = `${interaction.guildId}:${eventId}:${interaction.user.id}`;
  const previous = signupInteractionLocks.get(lockKey);
  let releaseLock: (() => void) | undefined;
  const current = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  signupInteractionLocks.set(lockKey, current);

  if (previous) {
    await previous.catch(() => undefined);
  }

  try {
    const context = (await convex.query(references.getEventSignupContext, {
      secret: env.internalSecret,
      guildId: interaction.guildId,
      eventId: eventId as never,
    })) as EventInteractionContext | null;

    if (!context) {
      await interaction.editReply({ content: getClanDiscordMessages("en").interaction.unableToLoadEventContext });
      return;
    }

    const member = interaction.member as GuildMember | null;
    const messages = getClanDiscordMessages(context.config.defaultLanguage);
    const assignment = context.assignments?.find((item) => item.userId === interaction.user.id);
    const resolvedMembershipStatus = assignment?.type && assignment.status
      ? getResolvedMemberStatus(assignment.type, assignment.status)
      : null;
    const membershipStatus = resolvedMembershipStatus && resolvedMembershipStatus !== "pending"
      ? resolvedMembershipStatus
      : null;
    const resolved = resolveEventSignupSelection({
      event: context.event,
      groups: context.groups,
      memberRoleIds: member ? [...member.roles.cache.keys()] : null,
      assignedGroupIds: assignment
        ? [assignment.primaryGroupId, ...(assignment.secondaryGroupIds ?? [])].filter((groupId): groupId is string => Boolean(groupId))
        : [],
      membershipStatus,
      actionId: groupId,
      labels: {
        registrationClosed: messages.interaction.registrationClosed,
        invalidSignupButton: messages.interaction.invalidSignupButton,
        unableToResolveMembership: messages.interaction.unableToResolveMembership,
        missingRequiredRole: messages.interaction.missingRequiredRole,
        membershipStatusNotAllowed: messages.interaction.membershipStatusNotAllowed,
        signupUpdated: messages.interaction.signupUpdated,
        markedNotAttending: messages.interaction.markedNotAttending,
      },
    });

    if (!resolved.ok) {
      await interaction.reply({
        content: resolved.error,
        ephemeral: true,
      });
      return;
    }

    const result = await convex.mutation(references.toggleSignUp, {
      secret: env.internalSecret,
      eventId: eventId as never,
      userId: interaction.user.id,
      group: resolved.group,
    }) as { appliedSignupLabel: string; removed: boolean };
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

    const actions = buildEventSignupActions(context.event, context.groups, messages.buttons);
    const emoji = getSignupActionEmoji(groupId, actions);

    await interaction.reply({
      content: formatSignupResultMessage({
        removed: result.removed,
        appliedSignupLabel: result.appliedSignupLabel,
        labels: { ...messages.interaction, ...messages.buttons },
        emoji,
      }),
      ephemeral: true,
    });
  } finally {
    releaseLock?.();
    if (signupInteractionLocks.get(lockKey) === current) {
      signupInteractionLocks.delete(lockKey);
    }
  }
}

async function handleAttendanceInteraction(
  interaction: ButtonInteraction,
  context: EventInteractionContext,
  options: InteractionHandlerOptions,
) {
  const messages = getClanDiscordMessages(context.config.defaultLanguage);

  if (context.event.status !== "starting") {
    await interaction.editReply({ content: messages.interaction.attendanceNotOpen });
    return;
  }
  if (!context.roster?.published) {
    await interaction.editReply({ content: messages.interaction.rosterNotPublished });
    return;
  }

  const isOnRoster = context.roster.squads.some((squad) =>
    squad.players.some((player) => player.id === interaction.user.id),
  );
  if (!isOnRoster) {
    await interaction.editReply({ content: messages.interaction.notOnRoster });
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

  await interaction.editReply({ content: messages.interaction.attendanceAcknowledged });
}
