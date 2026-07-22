import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { cache } from "react";

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

export const listUsersReadModel = cache(async function listUsersReadModel() {
  "use cache";
  tagCacheEntries([appCacheTags.users()]);
  return (await fetchQuery(listUsersReference, {})) as AppUser[];
});
