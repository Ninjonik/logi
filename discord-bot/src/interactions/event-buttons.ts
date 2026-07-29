import { type ButtonInteraction, type GuildMember } from "discord.js";

import { getClanDiscordMessages } from "../../../src/lib/clan-language";
import { resolveEventSignupSelection } from "../../../src/lib/event-signup";
import { revalidateAppData } from "../cache";
import { convex, references } from "../convex";
import { env } from "../environment";
import { logInfo } from "../log";
import type { EventInteractionContext } from "../types";

type InteractionHandlerOptions = {
  enqueueEventSync: (eventId: string) => void;
  triggerPollSoon: () => void;
};

export async function handleEventButtonInteraction(
  interaction: ButtonInteraction,
  options: InteractionHandlerOptions,
) {
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

  const member = interaction.member as GuildMember | null;
  const messages = getClanDiscordMessages(context.config.defaultLanguage);
  const resolved = resolveEventSignupSelection({
    event: context.event,
    groups: context.groups,
    memberRoleIds: member ? [...member.roles.cache.keys()] : null,
    actionId: groupId,
    labels: {
      registrationClosed: messages.interaction.registrationClosed,
      invalidSignupButton: messages.interaction.invalidSignupButton,
      unableToResolveMembership: messages.interaction.unableToResolveMembership,
      missingRequiredRole: messages.interaction.missingRequiredRole,
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

  await convex.mutation(references.toggleSignUp, {
    secret: env.internalSecret,
    eventId: eventId as never,
    userId: interaction.user.id,
    group: resolved.group,
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
    content: resolved.successMessage,
    ephemeral: true,
  });
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
