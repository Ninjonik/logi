import {
    ProviderError,
    observationSchema,
    type GameDataProvider,
} from "../../domain/game-data/contracts"
import { z } from "zod"
const count = z.number().int().nonnegative().safe()
const statusSchema = z.object({
    serverName: z.string().min(1).max(200),
    map: z.string().min(1).max(200).nullable(),
    players: z.object({ current: count, max: count }),
    factionScores: z
        .array(
            z.object({
                name: z.string().min(1).max(200),
                score: z.number().finite().nullable(),
            })
        )
        .max(16),
})
export const wardogsRconProvider: GameDataProvider = {
    readSnapshot: async (source, http, now) => {
        const capabilities = z
            .object({ routes: z.array(z.string()).max(200) })
            .safeParse((await http.get("/v1/capabilities")).body)
        if (!capabilities.success) throw new ProviderError("invalid_response")
        const routes = capabilities.data.routes.map((route) =>
            route.trim().replace(/\s+/g, " ")
        )
        if (!routes.includes("GET /v1/status"))
            throw new ProviderError("unsupported")
        const parsed = statusSchema.safeParse(
            (await http.get("/v1/status")).body
        )
        if (!parsed.success) throw new ProviderError("invalid_response")
        if (routes.includes("GET /v1/server-id")) {
            const identity = z
                .object({ serverId: z.string() })
                .safeParse((await http.get("/v1/server-id")).body)
            if (
                !identity.success ||
                identity.data.serverId !== source.providerServerId
            )
                throw new ProviderError("invalid_response")
        }
        const data = parsed.data
        if (
            new Set(data.factionScores.map((score) => score.name)).size !==
            data.factionScores.length
        )
            throw new ProviderError("invalid_response")
        return {
            observation: observationSchema.parse({
                observedAt: new Date(now()).toISOString(),
                providerUpdatedAt: null,
                displayName: data.serverName,
                state: "online",
                map: data.map,
                players: data.players.current,
                capacity: data.players.max,
                providerInstanceId: null,
                scores: data.factionScores.map((score) => ({
                    id: score.name,
                    label: score.name,
                    score: score.score,
                })),
                capabilities: ["server_snapshot"],
            }),
        }
    },
}
