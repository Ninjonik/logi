import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getLoggedInUser } from "@/lib/auth";
import { appCacheTags, tagCacheEntries } from "@/lib/cache-tags";

const getStratmapByIdReference = makeFunctionReference<"query">("stratmaps:getById");
const listStratmapsByGuildReference = makeFunctionReference<"query">("stratmaps:listByGuild");

export async function getStratmapDetail(stratmapId: string) {
  const user = await getLoggedInUser();
  if (!user) {
    return null;
  }

  tagCacheEntries([appCacheTags.stratmap(stratmapId)]);
  return await fetchQuery(getStratmapByIdReference, {
    userId: user.discordId,
    stratmapId: stratmapId as never,
  }) as {
    canAdmin: boolean;
    serverId: string;
    stratmap: {
      id: string;
      guildId: string;
      eventId?: string;
      title: string;
      description?: string;
      baseMapId: string;
      side?: string;
      strongpointId?: string;
      state: string;
      createdBy: string;
      createdAt: string;
      updatedAt: string;
    };
  } | null;
}

export async function listServerStratmaps(serverId: string) {
  const user = await getLoggedInUser();
  if (!user) {
    return null;
  }

  tagCacheEntries([appCacheTags.stratmaps(serverId), appCacheTags.serverContext(serverId)]);
  return await fetchQuery(listStratmapsByGuildReference, {
    userId: user.discordId,
    serverId: serverId as never,
  }) as {
    canAdmin: boolean;
    stratmaps: Array<{
      id: string;
      guildId: string;
      eventId?: string;
      title: string;
      description?: string;
      baseMapId: string;
      side?: string;
      strongpointId?: string;
      state: string;
      createdBy: string;
      createdAt: string;
      updatedAt: string;
    }>;
  } | null;
}
