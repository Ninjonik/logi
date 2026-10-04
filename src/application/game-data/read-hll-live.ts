import {
    ageHllLive,
    type HllLive,
    type HllLiveEnvelope,
} from "../../domain/game-data/hll-live"
import type { ResolvedSource } from "../../domain/game-data/credentials"

export type HllClaim = { cacheId: string; generation: number; fence: number }
export type HllPrepared =
    | { kind: "denied" }
    | { kind: "busy"; retryAfterMs: number }
    | { kind: "cached"; data: HllLive }
    | {
          kind: "claimed"
          claim: HllClaim
          source: ResolvedSource
          previous?: HllLive
      }
export type HllServed =
    | { kind: "denied" }
    | { kind: "busy"; retryAfterMs: number }
    | { kind: "ready"; envelope: HllLiveEnvelope }
export async function serveHllLive(
    connectionId: string,
    ports: {
        now(): number
        prepare(): Promise<HllPrepared>
        read(
            source: ResolvedSource,
            previous: HllLive | undefined,
            claim: HllClaim
        ): Promise<HllLive>
        finish(claim: HllClaim, data: HllLive): Promise<boolean>
    }
): Promise<HllServed> {
    const prepared = await ports.prepare()
    if (prepared.kind === "denied" || prepared.kind === "busy") return prepared
    const data =
        prepared.kind === "cached"
            ? prepared.data
            : await ports.read(
                  prepared.source,
                  prepared.previous,
                  prepared.claim
              )
    // An expired lease or a moved fence is a timing collision, not a scope failure.
    if (
        prepared.kind === "claimed" &&
        !(await ports.finish(prepared.claim, data))
    )
        return { kind: "busy", retryAfterMs: 5000 }
    return {
        kind: "ready",
        envelope: {
            connectionId,
            gameId: "hell_let_loose",
            provider: "hll_crcon",
            data: ageHllLive(data, ports.now()),
        },
    }
}
