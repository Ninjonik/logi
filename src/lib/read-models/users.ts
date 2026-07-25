import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { appCacheTags, tagCacheEntries } from "@/lib/cache-tags";
import type { AppUser } from "@/types/domain";

const getUsersByIdsReference = makeFunctionReference<"query">("users:getUsersByIds");
const listUsersReference = makeFunctionReference<"query">("users:listUsers");

export async function getUsersReadModelByIds(userIds: string[]) {
  "use cache";
  tagCacheEntries([
    appCacheTags.users(),
    ...userIds.map((userId) => appCacheTags.player(userId)),
  ]);
  return (await fetchQuery(getUsersByIdsReference, { userIds })) as AppUser[];
}

export async function listUsersReadModel() {
  "use cache";
  tagCacheEntries([appCacheTags.users()]);
  return (await fetchQuery(listUsersReference, {})) as AppUser[];
}

export async function listUsersReadModelUncached() {
  return (await fetchQuery(listUsersReference, {})) as AppUser[];
}
