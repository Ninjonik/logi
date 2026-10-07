import { canonicalJson } from "./canonical-json"
import type { HllLive } from "./hll-live"

/**
 * The HLL live payload as `hllLiveCache` stores it. `hllLiveReads:finish`
 * writes `dataJson` only after the read action validated the provider's
 * reply with `hllLiveSchema`, so its readers, which run on every panel
 * refresh, read it back through this guard instead of Zod (ARCHITECTURE.md,
 * "Convex hot paths").
 *
 * The provider data of an idle server is the same read after read; only the
 * times move. `finish` therefore keeps the times in small row fields
 * (`fetchedAt`, `statusAt`, `playersAt`) and rewrites the payload only when
 * the rest changed; every reader merges the row's times back in.
 */
export type HllLiveFreshness = {
    fetchedAt: string
    statusAt: string | null
    playersAt: string | null
}
/** The row fields that carry the freshness; absent on rows from before them. */
export type HllLiveFreshnessRow = Partial<HllLiveFreshness>

const AGES = ["fresh", "stale", "unavailable"] as const
const isNullableText = (value: unknown): value is string | null =>
    value === null || typeof value === "string"
const isNullableNumber = (value: unknown): value is number | null =>
    value === null || typeof value === "number"
const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value)

function isStatus(value: unknown): boolean {
    if (value === null) return true
    if (!isRecord(value)) return false
    return (
        typeof value.serverName === "string" &&
        isNullableText(value.map) &&
        isNullableText(value.layerId) &&
        isNullableText(value.mode) &&
        isNullableText(value.roundStartedAt) &&
        typeof value.playerCount === "number" &&
        typeof value.maxPlayers === "number" &&
        Array.isArray(value.scores) &&
        value.scores.every(
            (entry) =>
                isRecord(entry) &&
                (entry.team === "allies" || entry.team === "axis") &&
                typeof entry.score === "number"
        ) &&
        isNullableNumber(value.timeRemainingSeconds) &&
        (value.environment === undefined ||
            isNullableText(value.environment)) &&
        (value.queueCount === undefined ||
            isNullableNumber(value.queueCount)) &&
        (value.nextMap === undefined ||
            value.nextMap === null ||
            (isRecord(value.nextMap) && typeof value.nextMap.name === "string"))
    )
}

function isPlayer(value: unknown): boolean {
    return (
        isRecord(value) &&
        isNullableText(value.playerId) &&
        typeof value.name === "string" &&
        (value.team === null ||
            value.team === "allies" ||
            value.team === "axis") &&
        ["kills", "deaths", "combat", "offense", "defense", "support"].every(
            (key) => isNullableNumber(value[key])
        )
    )
}

export function isHllLive(value: unknown): value is HllLive {
    if (!isRecord(value)) return false
    return (
        typeof value.fetchedAt === "string" &&
        isNullableText(value.statusAt) &&
        isNullableText(value.playersAt) &&
        (AGES as readonly unknown[]).includes(value.statusFreshness) &&
        (AGES as readonly unknown[]).includes(value.playersFreshness) &&
        typeof value.refreshAfterSeconds === "number" &&
        isStatus(value.status) &&
        Array.isArray(value.players) &&
        value.players.every(isPlayer) &&
        Array.isArray(value.warnings) &&
        value.warnings.every((entry) => typeof entry === "string")
    )
}

/** The stored payload, or null when the text is not one Logi wrote. */
export function readHllLivePayload(json: string): HllLive | null {
    let value: unknown
    try {
        value = JSON.parse(json)
    } catch {
        return null
    }
    return isHllLive(value) ? value : null
}

/** The times of one read, kept in the row next to the payload. */
export function hllLiveFreshness(data: HllLive): HllLiveFreshness {
    return {
        fetchedAt: data.fetchedAt,
        statusAt: data.statusAt,
        playersAt: data.playersAt,
    }
}

/**
 * The payload with the row's times: the latest read's, when the row carries
 * them; the payload's own on rows written before the fields existed.
 */
export function hllLiveWithFreshness(
    data: HllLive,
    row: HllLiveFreshnessRow
): HllLive {
    if (row.fetchedAt === undefined) return data
    return {
        ...data,
        fetchedAt: row.fetchedAt,
        statusAt: row.statusAt === undefined ? data.statusAt : row.statusAt,
        playersAt: row.playersAt === undefined ? data.playersAt : row.playersAt,
    }
}

/** The payload without its times, canonically: equal strings mean the provider data did not change. */
export function hllLiveComparable(data: HllLive): string {
    return canonicalJson({
        ...data,
        fetchedAt: undefined,
        statusAt: undefined,
        playersAt: undefined,
    })
}
