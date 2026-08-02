import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getInternalAuthSecret } from "@/lib/env";
import { getLoggedInUser } from "@/lib/auth";
import { isSuperadminDiscordId } from "@/lib/superadmin";
import type { AppUser, DiscordConfig, EventRecord, Group, Guild, Roster, SquadPreset, StratmapRecord, TopicPreset } from "@/types/domain";
import type { ServerUserAssignment } from "@/lib/server-user-management";

const getServerContextReference = makeFunctionReference<"query">("serverContext:getServerContext");
const getServerContextInternalReference = makeFunctionReference<"query">("serverContext:getServerContextInternal");

export type ServerContextReadModel = {
  user: AppUser;
  server: Guild;
  canAdmin: boolean;
  memberRoleIds: string[];
  events: EventRecord[];
  topicPresets: TopicPreset[];
  squadPresets: SquadPreset[];
  rosters: Roster[];
  stratmaps: StratmapRecord[];
  groups: Group[];
  assignments: ServerUserAssignment[];
  discordConfig: DiscordConfig | null;
};

async function getServerContextSnapshot(serverId: string, userId: string): Promise<ServerContextReadModel | null> {
  return (await fetchQuery(getServerContextReference, {
    userId,
    serverId: serverId as never,
  })) as ServerContextReadModel | null;
}

async function getServerContextSnapshotInternal(serverId: string, userId: string): Promise<ServerContextReadModel | null> {
  return (await fetchQuery(getServerContextInternalReference, {
    secret: getInternalAuthSecret(),
    userId,
    serverId: serverId as never,
  })) as ServerContextReadModel | null;
}

export async function getServerContextReadModel(serverId: string): Promise<ServerContextReadModel | null> {
  const user = await getLoggedInUser();
  if (!user) {
    return null;
  }

  try {
    if (await isSuperadminDiscordId(user.discordId)) {
      return await getServerContextSnapshotInternal(serverId, user.discordId);
    }

    return await getServerContextSnapshot(serverId, user.discordId);
  } catch {
    return null;
  }
}
