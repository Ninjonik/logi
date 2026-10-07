import {
    isDataGame,
    isDataProvider,
    isErrorCategory,
    isObservedState,
    type DataGame,
    type DataProviderId,
    type ErrorCategoryId,
} from "./vocabulary"
import type {
    IntegrationHealth,
    ProviderObservation,
    RunToken,
    ServerSnapshot,
    StoredConnection,
} from "./contracts"

// `parseSources` (Zod) lives in `policy.schema.ts`; the projections below run
// on every panel refresh and read the schema-validated row as it is stored.

function isNullableText(value: unknown): value is string | null {
    return value === null || typeof value === "string"
}
function isNullableCount(value: unknown): value is number | null {
    return value === null || typeof value === "number"
}

/**
 * The stored observation of a `gameDataConnections` row. The schema and
 * `finishSnapshot` validate what is written; this narrows the field for the
 * projections without re-parsing it, and reads anything else as "none".
 */
export function storedObservation(value: unknown): ProviderObservation | null {
    if (!value || typeof value !== "object") return null
    const record = value as Record<string, unknown>
    if (
        typeof record.observedAt !== "string" ||
        !isNullableText(record.providerUpdatedAt) ||
        !isNullableText(record.displayName) ||
        !isObservedState(record.state) ||
        !isNullableText(record.map) ||
        !isNullableCount(record.players) ||
        !isNullableCount(record.capacity) ||
        !isNullableText(record.providerInstanceId) ||
        !Array.isArray(record.scores) ||
        !Array.isArray(record.capabilities)
    )
        return null
    return value as ProviderObservation
}

function storedGame(value: string): DataGame {
    if (!isDataGame(value)) throw new Error("Invalid stored connection.")
    return value
}
function storedProvider(value: string): DataProviderId {
    if (!isDataProvider(value)) throw new Error("Invalid stored connection.")
    return value
}
function storedErrorCategory(
    value: string | null | undefined
): ErrorCategoryId | null {
    if (value == null) return null
    if (!isErrorCategory(value)) throw new Error("Invalid stored connection.")
    return value
}

export function projectSnapshot(
    value: StoredConnection,
    now: number
): ServerSnapshot {
    const observation = storedObservation(value.observation)
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
    // Field order matches the former schema output, so stored digests of the
    // projection stay equal.
    return {
        observedAt: observation?.observedAt ?? null,
        providerUpdatedAt: observation?.providerUpdatedAt ?? null,
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
        id: value.id,
        guildId: value.guildId,
        gameId: storedGame(value.gameId),
        provider: storedProvider(value.provider),
        freshness,
        lastSuccessAt: observation?.observedAt ?? null,
        attribution:
            value.provider === "wardogs_public_directory"
                ? { label: "Wardog Servers", url: "https://wardogservers.com" }
                : null,
    }
}

/**
 * How long a reader of the stored status may still name the last observed
 * state, marked stale (board M3-23): a day. Older data reads "Bez dat".
 */
export const LAST_STATE_MAX_AGE_MS = 86_400_000

/**
 * The server state last observed, for readers of the stored status such as
 * `/server-status` (M3-23, M3-B04). {@link projectSnapshot} reports every
 * row that is not fresh as "unknown" and stays so for its other consumers;
 * this keeps what was last seen, online or offline, for at most
 * {@link LAST_STATE_MAX_AGE_MS}, so the reader can say "Online · zastaralé"
 * with the observation time instead of guessing. Null when collection is
 * off, nothing usable was observed, or the observation is too old.
 */
export function projectLastState(
    value: Pick<StoredConnection, "enabled" | "observation">,
    now: number
): "online" | "offline" | null {
    if (!value.enabled) return null
    const observation = storedObservation(value.observation)
    if (!observation || observation.state === "unknown") return null
    const age = now - Date.parse(observation.observedAt)
    return age >= 0 && age < LAST_STATE_MAX_AGE_MS ? observation.state : null
}

export function projectHealth(
    value: StoredConnection,
    now: number
): IntegrationHealth {
    const snapshot = projectSnapshot(value, now)
    return {
        id: value.id,
        guildId: value.guildId,
        gameId: snapshot.gameId,
        provider: snapshot.provider,
        enabled: value.enabled,
        capabilities: snapshot.capabilities,
        lastAttemptAt: value.lastAttemptAt,
        lastSuccessAt: snapshot.lastSuccessAt,
        nextAttemptAt:
            value.nextAttemptAt == null
                ? null
                : new Date(value.nextAttemptAt).toISOString(),
        errorCategory: storedErrorCategory(value.errorCategory),
        freshness: snapshot.freshness,
        collectedSessions: ["hll_crcon", "wardogs_warcon"].includes(
            value.provider
        )
            ? (value.historyCount ?? 0)
            : null,
        lastHistorySuccessAt: value.historyLastSuccessAt ?? null,
        historyErrorCategory: storedErrorCategory(value.historyErrorCategory),
    }
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
