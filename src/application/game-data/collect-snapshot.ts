import {
    CLOCK_SKEW_TOLERANCE_MS,
    observationSchema,
    ProviderError,
    type ClaimedConnection,
    type ErrorCategory,
    type GameDataProvider,
    type ProviderHttp,
    type ProviderObservation,
} from "../../domain/game-data/contracts"
import { retryDelay } from "../../domain/game-data/policy"
export type SnapshotFinish = {
    observation?: ProviderObservation
    etag?: string | null
    pollAfterMs?: number
    errorCategory: ErrorCategory | null
    nextAttemptAt: number | null
}
export type SnapshotPorts = {
    provider: GameDataProvider
    http: ProviderHttp
    now: () => number
    repository: { finish(value: SnapshotFinish): Promise<boolean> }
}
export async function collectSnapshot(
    connection: ClaimedConnection,
    ports: SnapshotPorts
): Promise<"completed" | "retry_scheduled" | "unavailable" | "stale_fence"> {
    let result: SnapshotFinish
    try {
        const read = await ports.provider.readSnapshot(
            connection,
            ports.http,
            ports.now
        )
        const parsed = observationSchema.safeParse(read.observation)
        const skewMs = parsed.success
            ? Date.parse(parsed.data.observedAt) - ports.now()
            : NaN
        // Provider clocks may run slightly ahead; clamp instead of failing the poll.
        if (!parsed.success || skewMs > CLOCK_SKEW_TOLERANCE_MS)
            throw new ProviderError("invalid_response")
        const observation =
            skewMs > 0
                ? {
                      ...parsed.data,
                      observedAt: new Date(ports.now()).toISOString(),
                  }
                : parsed.data
        const interval =
            read.pollAfterMs === undefined
                ? 60_000
                : Math.max(60_000, Math.min(read.pollAfterMs, 3_600_000))
        if (!Number.isFinite(interval))
            throw new ProviderError("invalid_response")
        result = {
            observation,
            etag: read.etag ?? null,
            ...(read.pollAfterMs === undefined
                ? {}
                : { pollAfterMs: interval }),
            errorCategory: null,
            nextAttemptAt: ports.now() + interval,
        }
    } catch (error) {
        const failure =
            error instanceof ProviderError
                ? error
                : new ProviderError("invalid_response")
        const delay = retryDelay(
            failure.category,
            connection.attempt,
            failure.retryAfterMs
        )
        result = {
            errorCategory: failure.category,
            nextAttemptAt: delay === null ? null : ports.now() + delay,
        }
    }
    if (!(await ports.repository.finish(result))) return "stale_fence"
    return result.errorCategory
        ? result.nextAttemptAt === null
            ? "unavailable"
            : "retry_scheduled"
        : "completed"
}
