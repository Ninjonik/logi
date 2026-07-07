import { fetchMutation } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getInternalAuthSecret } from "@/lib/env";

const initializeDefaultHelperDataReference = makeFunctionReference<"mutation">("serverSetup:initializeDefaultHelperDataForGuild");
const resetHelperDataReference = makeFunctionReference<"mutation">("serverSetup:resetHelperDataForGuild");

export async function initializeDefaultHelperData(serverId: string) {
  return await fetchMutation(initializeDefaultHelperDataReference, {
    secret: getInternalAuthSecret(),
    guildId: serverId,
  });
}

export async function resetHelperData(serverId: string) {
  return await fetchMutation(resetHelperDataReference, {
    secret: getInternalAuthSecret(),
    guildId: serverId,
  });
}
