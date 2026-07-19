import { fetchMutation } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getInternalAuthSecret } from "@/lib/env";
import type { SquadPresetInput } from "@/lib/validation/squad-preset";

const upsertSquadPresetReference = makeFunctionReference<"mutation">("squadPresets:upsert");

export async function saveSquadPreset(input: SquadPresetInput & {
  serverId: string;
  presetId?: string;
}) {
  return await fetchMutation(upsertSquadPresetReference, {
    secret: getInternalAuthSecret(),
    serverId: input.serverId,
    presetId: input.presetId as never,
    name: input.name,
    squads: input.squads,
  });
}
