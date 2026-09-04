import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { appCacheTags, cachedRead } from "@/lib/cache-tags";
import type { AppUser } from "@/types/domain";

const getUsersByIdsReference = makeFunctionReference<"query">("users:getUsersByIds");
const listUsersReference = makeFunctionReference<"query">("users:listUsers");

export async function getUsersReadModelByIds(userIds: string[], guildId?: string) {
  return await cachedRead(["users-by-id", guildId ?? "all", [...userIds].sort().join(",")], [
    appCacheTags.users(),
    ...userIds.map((userId) => appCacheTags.player(userId)),
  ], async () => (await fetchQuery(getUsersByIdsReference, { userIds, guildId })) as AppUser[]);
}

export async function listUsersReadModel(guildId?: string) {
  return await cachedRead(["users", guildId ?? "all"], [appCacheTags.users()], async () => (await fetchQuery(listUsersReference, { guildId })) as AppUser[]);
}

export async function listUsersReadModelUncached(guildId?: string) {
  return (await fetchQuery(listUsersReference, { guildId })) as AppUser[];
}
