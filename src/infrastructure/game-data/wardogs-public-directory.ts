import {
    CLOCK_SKEW_TOLERANCE_MS,
    ProviderError,
    observationSchema,
    type GameDataProvider,
} from "../../domain/game-data/contracts"
import { z } from "zod"
const timestamp = z.iso.datetime({ offset: true })
const directorySchema = z.object({
    data: z.object({
        id: z.uuid(),
        serverId: z.string().nullable(),
        observedAt: timestamp,
        name: z.string().max(200),
        region: z.string(),
        type: z.enum(["official", "community"]),
        players: z.number().int().nonnegative().safe(),
        maxPlayers: z.number().int().nonnegative().safe(),
        map: z.object({
            variant: z.string().nullable(),
            base: z.string().nullable(),
        }),
    }),
    meta: z.object({
        fetchedAt: timestamp,
        refreshSeconds: z.number().int().min(30).max(3600),
        stale: z.boolean(),
        observedRegions: z.array(z.string()),
        complete: z.boolean(),
        partial: z.array(z.string()),
    }),
})
export const wardogsDirectoryProvider: GameDataProvider = {
    readSnapshot: async (source, http, now) => {
        if (
            !/^(?:\d{1,64}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/.test(
                source.providerServerId
            )
        )
            throw new ProviderError("configuration")
        const response = await http.get(
            `/v1/servers/${encodeURIComponent(source.providerServerId)}`,
            { etag: source.etag }
        )
        if (response.status === 404) throw new ProviderError("not_listed")
        if (response.status === 304) {
            const cached = observationSchema.safeParse(source.observation)
            if (!cached.success || !source.etag)
                throw new ProviderError("invalid_response")
            return {
                observation: cached.data,
                etag: response.etag ?? source.etag,
                pollAfterMs: source.pollAfterMs ?? 60_000,
            }
        }
        const parsed = directorySchema.safeParse(response.body)
        if (!parsed.success) throw new ProviderError("invalid_response")
        const { data, meta } = parsed.data
        if (
            data.serverId !== source.providerServerId ||
            Date.parse(data.observedAt) > Date.parse(meta.fetchedAt) ||
            Date.parse(meta.fetchedAt) > now() + CLOCK_SKEW_TOLERANCE_MS
        )
            throw new ProviderError("invalid_response")
        return {
            etag: response.etag,
            pollAfterMs: meta.refreshSeconds * 1000,
            observation: observationSchema.parse({
                observedAt: new Date(
                    Math.min(Date.parse(data.observedAt), now())
                ).toISOString(),
                providerUpdatedAt: new Date(meta.fetchedAt).toISOString(),
                displayName: data.name || null,
                state:
                    meta.stale ||
                    !meta.observedRegions.includes(data.region) ||
                    meta.partial.includes(`${data.region} ${data.type}`)
                        ? "unknown"
                        : "online",
                map: data.map.variant ?? data.map.base,
                players: data.players,
                capacity: data.maxPlayers,
                providerInstanceId: data.id,
                scores: [],
                capabilities: ["server_snapshot"],
            }),
        }
    },
}
