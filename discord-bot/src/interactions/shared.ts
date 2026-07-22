import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  type Guild,
  type ThreadChannel,
} from "discord.js";

import { getClanDiscordMessages } from "../../../src/lib/clan-language";

import { revalidateAppData } from "../cache";
import { convex, references } from "../convex";
import { env } from "../environment";
import { logWarn } from "../log";
import type { EventInteractionContext } from "../types";
import { resolveMembershipRoleIds } from "./rules";

export function formatTemplate(template: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.split(`{${key}}`).join(value),
    template,
  );
}

export function getOutcomeLabel(language: "en" | "cs", outcome: "denied" | "pending" | "recruit" | "member" | "mercenary") {
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

export async function loadTicketCategoryContext(guildId: string, categoryId: string) {
  return await convex.query(references.getTicketCategoryContext, {
    secret: env.internalSecret,
    guildId,
    categoryId,
  }) as {
    config: EventInteractionContext["config"];
    category: import("../types").TicketCategory;
  } | null;
}

export async function loadMembershipCategoryContext(guildId: string, categoryId: string) {
  return await convex.query(references.getMembershipCategoryContext, {
    secret: env.internalSecret,
    guildId,
    categoryId,
  }) as {
    config: EventInteractionContext["config"];
    category: import("../types").MembershipCategory;
  } | null;
}

export function resolveSupportMemberIds(guild: Guild, supportRoleIds: string[], dashboardAdminRoleId?: string) {
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

export async function sendPlatformIdDm(interaction: ButtonInteraction, link: string, language: "en" | "cs") {
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

export async function syncMembershipRoles(
  guild: Guild,
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

export async function cleanupThread(thread: ThreadChannel, reason: string) {
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

export async function rollbackMembershipApplicationSetup(input: {
  guild: Guild;
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
