import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getInternalAuthSecret } from "@/lib/env";
import type { DiscordConfig } from "@/types/domain";

const getConfigByGuildReference = makeFunctionReference<"query">("discord:getConfigByGuild");
const upsertConfigReference = makeFunctionReference<"mutation">("discord:upsertConfig");

export async function getDiscordConfigByGuild(guildId: string) {
  return (await fetchQuery(getConfigByGuildReference, { guildId })) as DiscordConfig | null;
}

export async function saveDiscordConfig(input: {
  guildId: string;
  timezone: string;
  announcementsChannelId?: string;
  forumChannelId?: string;
  clanRoleId?: string;
  dashboardAdminRoleId?: string;
  groupLinks: { groupId: string; roleId?: string; emoji?: string }[];
}) {
  return await fetchMutation(upsertConfigReference, {
    secret: getInternalAuthSecret(),
    guildId: input.guildId,
    timezone: input.timezone,
    announcementsChannelId: input.announcementsChannelId,
    forumChannelId: input.forumChannelId,
    clanRoleId: input.clanRoleId,
    dashboardAdminRoleId: input.dashboardAdminRoleId,
    groupLinks: input.groupLinks.map((link) => ({
      groupId: link.groupId as never,
      roleId: link.roleId,
      emoji: link.emoji,
    })),
  });
}
