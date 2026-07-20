import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { appCacheTags, tagCacheEntries } from "@/lib/cache-tags";
import { getInternalAuthSecret } from "@/lib/env";
import type { Group } from "@/types/domain";

const listGroupsReference = makeFunctionReference<"query">("groups:listForGuild");
const getGroupByIdReference = makeFunctionReference<"query">("groups:getById");
const upsertGroupReference = makeFunctionReference<"mutation">("groups:upsert");
const removeGroupReference = makeFunctionReference<"mutation">("groups:remove");

export async function getServerGroups(serverId: string) {
  "use cache";
  tagCacheEntries([appCacheTags.groups(serverId)]);
  return (await fetchQuery(listGroupsReference, { guildId: serverId as never })) as Group[];
}

export async function getServerGroup(groupId: string) {
  "use cache";
  tagCacheEntries([appCacheTags.group(groupId)]);
  return (await fetchQuery(getGroupByIdReference, { groupId: groupId as never })) as Group | null;
}

export async function saveServerGroup(input: {
  serverId: string;
  groupId?: string;
  name: string;
  color: string;
  order: number;
  parentId?: string;
  description?: string;
  discordRoleId?: string;
  discordEmoji?: string;
}) {
  return await fetchMutation(upsertGroupReference, {
    secret: getInternalAuthSecret(),
    guildId: input.serverId as never,
    groupId: input.groupId as never,
    name: input.name,
    color: input.color,
    order: input.order,
    parentId: input.parentId,
    description: input.description,
    discordRoleId: input.discordRoleId,
    discordEmoji: input.discordEmoji,
  });
}

export async function deleteServerGroup(groupId: string) {
  return await fetchMutation(removeGroupReference, {
    secret: getInternalAuthSecret(),
    groupId: groupId as never,
  });
}
