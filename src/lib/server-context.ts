import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getLoggedInUser } from "@/lib/auth";
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

export async function getServerContext(serverId: string): Promise<ServerContext | null> {
  const user = await getLoggedInUser();
  if (!user) {
    return null;
  }

  try {
    return (await fetchQuery(getServerContextReference, {
      userId: user.id,
      serverId,
    })) as ServerContext;
  } catch {
    return null;
  }
}
