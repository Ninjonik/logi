import { makeFunctionReference } from "convex/server"
import { fetchMutation } from "convex/nextjs"

import type { SquadPresetInput } from "@/lib/validation/squad-preset"
import type { GameId } from "@/domain/games/game"
import { getInternalAuthSecret } from "@/lib/env"

const upsertSquadPresetReference = makeFunctionReference<"mutation">(
    "squadPresets:upsert"
)
const removeSquadPresetReference = makeFunctionReference<"mutation">(
    "squadPresets:remove"
)

export async function saveSquadPreset(
    input: SquadPresetInput & {
        serverId: string
        presetId?: string
        gameId: GameId
    }
) {
    return await fetchMutation(upsertSquadPresetReference, {
        secret: getInternalAuthSecret(),
        serverId: input.serverId,
        presetId: input.presetId as never,
        gameId: input.gameId,
        name: input.name,
        squads: input.squads,
    })
}

/** Deletes a clan's squad preset; rosters keep the squads they copied. */
export async function deleteSquadPreset(input: {
    serverId: string
    presetId: string
}): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
    return (await fetchMutation(removeSquadPresetReference, {
        secret: getInternalAuthSecret(),
        serverId: input.serverId as never,
        presetId: input.presetId as never,
    })) as { ok: true } | { ok: false; error: "not_found" }
}
