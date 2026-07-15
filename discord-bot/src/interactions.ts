import { ButtonInteraction, GuildMember } from "discord.js";

import { getClanDiscordMessages } from "../../src/lib/clan-language";

import { SIGNUP_NOT_ATTENDING, TRAINING_ATTEND } from "./constants";
import { convex, references } from "./convex";
import { env } from "./environment";
import type { EventInteractionContext } from "./types";
import { revalidateRosterImage } from "./utils";

type InteractionHandlerOptions = {
  enqueueEventSync: (eventId: string) => void;
  triggerPollSoon: () => void;
};

export function createInteractionHandler(options: InteractionHandlerOptions) {
  const { enqueueEventSync, triggerPollSoon } = options;

  return async function handleButtonInteraction(interaction: ButtonInteraction) {
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

    if (context.event.status !== "registration") {
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

    enqueueEventSync(eventId);
    triggerPollSoon();

    await interaction.reply({
      content:
        selectedGroup || isTrainingAttend
          ? getClanDiscordMessages(context.config.defaultLanguage).interaction.signupUpdated
          : getClanDiscordMessages(context.config.defaultLanguage).interaction.markedNotAttending,
      ephemeral: true,
    });
  };
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
