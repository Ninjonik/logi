import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { cache } from "react";

import { getLoggedInUser } from "@/lib/auth";
import { appCacheTags, tagCacheEntries } from "@/lib/cache-tags";
import type { AppUser, DiscordConfig, EventRecord, Group, Guild, Roster, SquadPreset, TopicPreset } from "@/types/domain";
import type { ServerUserAssignment } from "@/lib/server-user-management";

const getServerContextReference = makeFunctionReference<"query">("serverData:getServerContext");

export type ServerContext = {
  user: AppUser;
  server: Guild;
  canAdmin: boolean;
  events: EventRecord[];
  topicPresets: TopicPreset[];
  squadPresets: SquadPreset[];
  rosters: Roster[];
  groups: Group[];
  assignments: ServerUserAssignment[];
  discordConfig: DiscordConfig | null;
};

async function getServerContextCached(serverId: string, userId: string): Promise<ServerContext | null> {
  "use cache";

  tagCacheEntries([
    appCacheTags.server(serverId),
    appCacheTags.serverContext(serverId),
    appCacheTags.events(serverId),
    appCacheTags.rosters(serverId),
    appCacheTags.groups(serverId),
    appCacheTags.assignments(serverId),
    appCacheTags.topicPresets(serverId),
    appCacheTags.squadPresets(serverId),
    appCacheTags.discordConfig(serverId),
    appCacheTags.player(userId),
    appCacheTags.matches(serverId),
  ]);

  return (await fetchQuery(getServerContextReference, {
    userId,
    serverId: serverId as never,
  })) as ServerContext | null;
}

export const getServerContext = cache(async function getServerContext(serverId: string): Promise<ServerContext | null> {
  const user = await getLoggedInUser();
  if (!user) {
    return null;
  }

  try {
    return await getServerContextCached(serverId, user.discordId);
  } catch {
    return null;
  }
});
