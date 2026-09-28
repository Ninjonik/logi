import { v } from "convex/values"
export const gameDataError = v.union(
    v.literal("timeout"),
    v.literal("network"),
    v.literal("rate_limited"),
    v.literal("unauthorized"),
    v.literal("invalid_response"),
    v.literal("unsupported"),
    v.literal("configuration"),
    v.literal("not_listed")
)
export const gameDataObservation = v.object({
    observedAt: v.string(),
    providerUpdatedAt: v.union(v.string(), v.null()),
    displayName: v.union(v.string(), v.null()),
    state: v.union(
        v.literal("online"),
        v.literal("offline"),
        v.literal("unknown")
    ),
    map: v.union(v.string(), v.null()),
    players: v.union(v.number(), v.null()),
    capacity: v.union(v.number(), v.null()),
    providerInstanceId: v.union(v.string(), v.null()),
    scores: v.array(
        v.object({
            id: v.string(),
            label: v.string(),
            score: v.union(v.number(), v.null()),
        })
    ),
    capabilities: v.array(
        v.union(v.literal("server_snapshot"), v.literal("match_history"))
    ),
})
export const gameDataHistoryProgress = v.object({
    page: v.number(),
    pendingIds: v.array(v.string()),
    nextPage: v.union(v.number(), v.null()),
})
export const gameDataSession = v.object({
    externalId: v.string(),
    startedAt: v.union(v.string(), v.null()),
    endedAt: v.union(v.string(), v.null()),
    complete: v.boolean(),
    map: v.union(v.string(), v.null()),
    sourceDigest: v.string(),
    participants: v.array(
        v.object({
            id: v.string(),
            label: v.string(),
            score: v.union(v.number(), v.null()),
        })
    ),
    players: v.array(
        v.object({
            platform: v.union(
                v.literal("steam"),
                v.literal("xbox"),
                v.literal("unknown")
            ),
            platformId: v.string(),
            metrics: v.record(v.string(), v.union(v.number(), v.null())),
        })
    ),
})
