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
  forumCategoryId?: string;
  clanRoleId?: string;
  dashboardAdminRoleId?: string;
}) {
  return await fetchMutation(upsertConfigReference, {
    secret: getInternalAuthSecret(),
    guildId: input.guildId,
    timezone: input.timezone,
    announcementsChannelId: input.announcementsChannelId,
    forumCategoryId: input.forumCategoryId,
    clanRoleId: input.clanRoleId,
    dashboardAdminRoleId: input.dashboardAdminRoleId,
  });
}
