import { fetchMutation } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getInternalAuthSecret } from "@/lib/env";

const updateFrontendSettingsReference = makeFunctionReference<"mutation">("guilds:updateFrontendSettings");

export async function saveGuildFrontendSettings(input: {
  guildId: string;
  name: string;
  avatar: string;
  description?: string;
  rosterScoreSettings: {
    noResponse: number;
    declined: number;
    accepted: number;
  };
}) {
  return await fetchMutation(updateFrontendSettingsReference, {
    secret: getInternalAuthSecret(),
    guildId: input.guildId,
    name: input.name,
    avatar: input.avatar,
    description: input.description,
    rosterScoreSettings: input.rosterScoreSettings,
  });
}
