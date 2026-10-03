import {
    warconEnvelopeSchema,
    warconFreshness,
    type WarconEnvelope,
    type WarconRead,
} from "../../domain/game-data/warcon-contracts"
import {
    ProviderError,
    type DataSource,
    type ErrorCategory,
} from "../../domain/game-data/contracts"
import {
    warconCacheMs,
    type WarconQuery,
} from "../../domain/game-data/warcon-query"

export type WarconClaim = { cacheId: string; generation: number; fence: number }
export type WarconPrepared =
    | { kind: "denied" }
    | { kind: "busy"; retryAfterMs: number }
    | { kind: "cached"; envelope: WarconEnvelope }
    | { kind: "claimed"; claim: WarconClaim; source: DataSource }
export type WarconFinish = {
    envelope?: WarconEnvelope
    errorCategory?: ErrorCategory
    retryAfterMs?: number
}
export type WarconServed =
    | { kind: "ready"; envelope: WarconEnvelope }
    | { kind: "denied" }
    | { kind: "busy"; retryAfterMs: number }
    | { kind: "failed"; errorCategory: ErrorCategory; retryAfterMs: number }
export type WarconReadPorts = {
    now(): number
    prepare(): Promise<WarconPrepared>
    read(source: DataSource, query: WarconQuery): Promise<WarconRead>
    finish(claim: WarconClaim, value: WarconFinish): Promise<boolean>
}

export function refreshWarconEnvelope(
    envelope: WarconEnvelope,
    now: number
): WarconEnvelope {
    const result = envelope.result
    return result.view !== "live"
        ? envelope
        : {
              ...envelope,
              result: {
                  ...result,
                  data: {
                      ...result.data,
                      freshness: warconFreshness(
                          result.data.statusAt,
                          now,
                          result.data.ok
                      ),
                      playersFreshness: warconFreshness(
                          result.data.playersAt,
                          now,
                          result.data.ok
                      ),
                  },
              },
          }
}
export async function serveWarconRead(
    connectionId: string,
    query: WarconQuery,
    ports: WarconReadPorts
): Promise<WarconServed> {
    const prepared = await ports.prepare()
    if (prepared.kind === "denied" || prepared.kind === "busy") return prepared
    if (prepared.kind === "cached")
        return {
            kind: "ready",
            envelope: refreshWarconEnvelope(prepared.envelope, ports.now()),
        }
    let finish: WarconFinish
    try {
        const result = await ports.read(prepared.source, query)
        const now = ports.now()
        const envelope = warconEnvelopeSchema.parse({
            connectionId,
            gameId: "wardogs",
            provider: "wardogs_warcon",
            fetchedAt: new Date(now).toISOString(),
            cacheUntil: new Date(now + warconCacheMs(query)).toISOString(),
            result,
        })
        if (
            new TextEncoder().encode(JSON.stringify(envelope)).length >
            512 * 1024
        )
            throw new ProviderError("invalid_response")
        finish = { envelope }
    } catch (error) {
        const failure =
            error instanceof ProviderError
                ? error
                : new ProviderError("invalid_response")
        finish = {
            errorCategory: failure.category,
            retryAfterMs: Math.max(
                1000,
                Math.min(failure.retryAfterMs ?? 30_000, 86_400_000)
            ),
        }
    }
    // Revocation, source edits, disable and expired worker claims fence the response as well as storage.
    if (!(await ports.finish(prepared.claim, finish))) return { kind: "denied" }
    return finish.envelope
        ? {
              kind: "ready",
              envelope: refreshWarconEnvelope(finish.envelope, ports.now()),
          }
        : {
              kind: "failed",
              errorCategory: finish.errorCategory!,
              retryAfterMs: finish.retryAfterMs!,
          }
}
