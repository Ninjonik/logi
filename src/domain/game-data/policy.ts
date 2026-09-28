import {
    sourceSchema,
    observationSchema,
    serverSnapshotSchema,
    integrationHealthSchema,
    type RunToken,
    type StoredConnection,
} from "./contracts"
import { z } from "zod"

export function parseSources(value: string | undefined) {
    try {
        const sources = z
            .array(sourceSchema)
            .max(100)
            .parse(value ? JSON.parse(value) : [])
        if (
            new Set(sources.map((source) => source.ref)).size !== sources.length
        )
            throw new Error()
        return sources
    } catch {
        throw new Error("Invalid game data source configuration.")
    }
}

export function projectSnapshot(value: StoredConnection, now: number) {
    const parsed = observationSchema.safeParse(value.observation)
    const observation = parsed.success ? parsed.data : null
    const age = observation
        ? now - Date.parse(observation.observedAt)
        : Infinity
    const freshness =
        !value.enabled || age < 0 || age >= 900_000
            ? "unavailable"
            : value.errorCategory ||
                observation?.state === "unknown" ||
                age >= 180_000
              ? "stale"
              : "fresh"
    return serverSnapshotSchema.parse({
        id: value.id,
        guildId: value.guildId,
        gameId: value.gameId,
        provider: value.provider,
        displayName: observation?.displayName ?? null,
        state:
            freshness !== "fresh"
                ? "unknown"
                : (observation?.state ?? "unknown"),
        map: observation?.map ?? null,
        players: observation?.players ?? null,
        capacity: observation?.capacity ?? null,
        providerInstanceId: observation?.providerInstanceId ?? null,
        scores: observation?.scores ?? [],
        capabilities: observation?.capabilities ?? [],
        observedAt: observation?.observedAt ?? null,
        lastSuccessAt: observation?.observedAt ?? null,
        providerUpdatedAt: observation?.providerUpdatedAt ?? null,
        freshness,
        attribution:
            value.provider === "wardogs_public_directory"
                ? { label: "Wardog Servers", url: "https://wardogservers.com" }
                : null,
    })
}

export function projectHealth(value: StoredConnection, now: number) {
    const snapshot = projectSnapshot(value, now)
    return integrationHealthSchema.parse({
        id: value.id,
        guildId: value.guildId,
        gameId: value.gameId,
        provider: value.provider,
        enabled: value.enabled,
        capabilities: snapshot.capabilities,
        lastAttemptAt: value.lastAttemptAt,
        lastSuccessAt: snapshot.lastSuccessAt,
        nextAttemptAt:
            value.nextAttemptAt == null
                ? null
                : new Date(value.nextAttemptAt).toISOString(),
        errorCategory: value.errorCategory,
        freshness: snapshot.freshness,
        collectedSessions:
            value.provider === "hll_crcon" ? (value.historyCount ?? 0) : null,
        lastHistorySuccessAt: value.historyLastSuccessAt ?? null,
        historyErrorCategory: value.historyErrorCategory ?? null,
    })
}

export function acceptsRun(
    value: Pick<
        StoredConnection,
        "enabled" | "generation" | "fence" | "leaseUntil"
    >,
    run: RunToken,
    now: number
) {
    return (
        value.enabled &&
        value.generation === run.generation &&
        value.fence === run.fence &&
        value.leaseUntil > now
    )
}

export function retryDelay(
    error: string,
    attempt: number,
    retryAfter?: number
): number | null {
    if (["unauthorized", "unsupported", "configuration"].includes(error))
        return null
    return Math.max(
        retryAfter ?? 0,
        attempt < 3 ? 5_000 * Math.max(1, attempt) : 60_000
    )
}
