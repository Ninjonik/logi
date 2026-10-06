import type { WarconEnvelope } from "./warcon-contracts"
import { isWarconView } from "./warcon-query-payload"
import { canonicalJson } from "./canonical-json"

/**
 * The Warcon envelope as `warconReadCache` stores it. `warconReads:finish`
 * writes `envelopeJson` only after the read action built the envelope with
 * `warconEnvelopeSchema`, so the mutations read it back through this guard
 * instead of Zod (ARCHITECTURE.md, "Convex hot paths").
 *
 * The live view of an idle server reads the same every ten seconds; only
 * `fetchedAt`, `cacheUntil` and the panel's own `statusAt`, `playersAt` and
 * `observedAt` move. `finish` keeps those in small row fields and rewrites
 * the payload only when the rest changed; every reader merges them back in.
 */
export type WarconFreshness = {
    fetchedAt: string
    statusAt?: string | null
    playersAt?: string | null
    observedAt?: string | null
}
/** The row fields that carry the freshness; `fetchedAt` is absent on older rows. */
export type WarconFreshnessRow = Partial<WarconFreshness> & {
    cacheUntil: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value)
const isNullableText = (value: unknown): value is string | null =>
    value === null || typeof value === "string"

export function isWarconEnvelope(value: unknown): value is WarconEnvelope {
    if (!isRecord(value) || !isRecord(value.result)) return false
    const result = value.result
    if (
        typeof value.connectionId !== "string" ||
        value.gameId !== "wardogs" ||
        value.provider !== "wardogs_warcon" ||
        typeof value.fetchedAt !== "string" ||
        typeof value.cacheUntil !== "string" ||
        !isWarconView(result.view) ||
        !("data" in result)
    )
        return false
    if (result.view === "match")
        return result.data === null || isRecord(result.data)
    if (!isRecord(result.data)) return false
    if (result.view !== "live") return true
    const live = result.data
    return (
        typeof live.ok === "boolean" &&
        (live.status === null || isRecord(live.status)) &&
        Array.isArray(live.players) &&
        isNullableText(live.statusAt) &&
        isNullableText(live.playersAt) &&
        isNullableText(live.observedAt) &&
        typeof live.freshness === "string" &&
        typeof live.playersFreshness === "string"
    )
}

/** The stored envelope, or null when the text is not one Logi wrote. */
export function readWarconEnvelope(json: string): WarconEnvelope | null {
    let value: unknown
    try {
        value = JSON.parse(json)
    } catch {
        return null
    }
    return isWarconEnvelope(value) ? value : null
}

/** The times of one read, kept in the row next to the payload. */
export function warconFreshnessOf(envelope: WarconEnvelope): WarconFreshness {
    const result = envelope.result
    return result.view === "live"
        ? {
              fetchedAt: envelope.fetchedAt,
              statusAt: result.data.statusAt,
              playersAt: result.data.playersAt,
              observedAt: result.data.observedAt,
          }
        : { fetchedAt: envelope.fetchedAt }
}

/**
 * The envelope with the row's times: the latest read's, when the row carries
 * them (`cacheUntil` is the row's own number); the payload's own on rows
 * written before the fields existed.
 */
export function warconEnvelopeWithFreshness(
    envelope: WarconEnvelope,
    row: WarconFreshnessRow
): WarconEnvelope {
    if (row.fetchedAt === undefined) return envelope
    const base = {
        ...envelope,
        fetchedAt: row.fetchedAt,
        cacheUntil: new Date(row.cacheUntil).toISOString(),
    }
    const result = base.result
    if (result.view !== "live") return base
    return {
        ...base,
        result: {
            ...result,
            data: {
                ...result.data,
                statusAt:
                    row.statusAt === undefined
                        ? result.data.statusAt
                        : row.statusAt,
                playersAt:
                    row.playersAt === undefined
                        ? result.data.playersAt
                        : row.playersAt,
                observedAt:
                    row.observedAt === undefined
                        ? result.data.observedAt
                        : row.observedAt,
            },
        },
    }
}

/**
 * The envelope without its times and derived freshness, canonically: equal
 * strings mean the provider data did not change.
 */
export function warconComparable(envelope: WarconEnvelope): string {
    const result = envelope.result
    return canonicalJson({
        ...envelope,
        fetchedAt: undefined,
        cacheUntil: undefined,
        result:
            result.view === "live"
                ? {
                      view: result.view,
                      data: {
                          ...result.data,
                          statusAt: undefined,
                          playersAt: undefined,
                          observedAt: undefined,
                          freshness: undefined,
                          playersFreshness: undefined,
                      },
                  }
                : result,
    })
}
