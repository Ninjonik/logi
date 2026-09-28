import {
    ProviderError,
    observationSchema,
    type GameDataProvider,
} from "../../domain/game-data/contracts"
import { z } from "zod"
export function crconResult(body: unknown): unknown {
    const envelope = z
        .object({ failed: z.boolean(), result: z.unknown() })
        .safeParse(body)
    if (!envelope.success || envelope.data.failed)
        throw new ProviderError("invalid_response")
    return envelope.data.result
}
const count = z.number().int().nonnegative().safe()
const publicInfo = z.object({
    name: z.object({ name: z.string().min(1).max(200) }),
    current_map: z
        .object({
            map: z
                .object({ pretty_name: z.string().min(1).max(200) })
                .nullable(),
        })
        .nullable(),
    player_count: count,
    max_player_count: count,
    score: z.object({ allied: count, axis: count }).nullable(),
})
export const hllCrconProvider: GameDataProvider = {
    readSnapshot: async (_source, http, now) => {
        const response = await http.get("/api/get_public_info")
        const parsed = publicInfo.safeParse(crconResult(response.body))
        if (!parsed.success) throw new ProviderError("invalid_response")
        const data = parsed.data
        return {
            observation: observationSchema.parse({
                observedAt: new Date(now()).toISOString(),
                providerUpdatedAt: null,
                displayName: data.name.name,
                state: "online",
                map: data.current_map?.map?.pretty_name ?? null,
                players: data.player_count,
                capacity: data.max_player_count,
                providerInstanceId: null,
                scores: data.score
                    ? [
                          {
                              id: "allied",
                              label: "Allies",
                              score: data.score.allied,
                          },
                          { id: "axis", label: "Axis", score: data.score.axis },
                      ]
                    : [],
                capabilities: ["server_snapshot", "match_history"],
            }),
        }
    },
}
