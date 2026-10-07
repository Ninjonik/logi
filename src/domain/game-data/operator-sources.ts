import { isDataGame, isDataProvider } from "./vocabulary"
import type { DataSource } from "./contracts"

/**
 * Hand-written reader of a stored provider source: the operator catalogue
 * (`LOGI_GAME_DATA_SOURCES`) and the `sourceFingerprint` a connection keeps,
 * both JSON Logi wrote or the operator configured. It mirrors `sourceSchema`
 * rule for rule (`policy.schema.ts` keeps the Zod schema for tests and
 * operator tooling) without loading Zod on the read path, which every panel
 * refresh and live read walks (ARCHITECTURE.md, "Convex hot paths").
 */
const SOURCE_KEYS = [
    "ref",
    "guildId",
    "gameId",
    "provider",
    "providerServerId",
    "origin",
    "secretRef",
    "allowedAddresses",
] as const
const REF = /^[a-z0-9][a-z0-9_-]{0,63}$/
const SECRET_REF = /^LOGI_GAME_DATA_[A-Z0-9_]+_TOKEN$/
/** Zod's `z.uuid()`: RFC 4122 versions 1–8 plus the nil and max UUIDs. */
const UUID =
    /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/
const MAX_SOURCES = 100

function isText(value: unknown): value is string {
    return typeof value === "string" && value.length >= 1 && value.length <= 200
}

/** `https://host[:port]` with nothing else: no credentials, path, query or hash. */
export function isSourceOrigin(value: string): boolean {
    let url: URL
    try {
        url = new URL(value)
    } catch {
        return false
    }
    return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash
    )
}

/** One stored source, or null when it does not satisfy `sourceSchema`'s rules. */
export function readStoredSource(value: unknown): DataSource | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const record = value as Record<string, unknown>
    if (
        Object.keys(record).some(
            (key) => !(SOURCE_KEYS as readonly string[]).includes(key)
        )
    )
        return null
    const {
        ref,
        guildId,
        gameId,
        provider,
        providerServerId,
        origin,
        secretRef,
        allowedAddresses,
    } = record
    if (typeof ref !== "string" || !REF.test(ref)) return null
    if (
        !isText(guildId) ||
        !isDataGame(gameId) ||
        !isDataProvider(provider) ||
        !isText(providerServerId)
    )
        return null
    if (typeof origin !== "string" || !isSourceOrigin(origin)) return null
    if (
        secretRef !== null &&
        (typeof secretRef !== "string" || !SECRET_REF.test(secretRef))
    )
        return null
    const addresses = allowedAddresses === undefined ? [] : allowedAddresses
    if (
        !Array.isArray(addresses) ||
        addresses.length > 16 ||
        !addresses.every(
            (entry) =>
                typeof entry === "string" &&
                entry.length >= 1 &&
                entry.length <= 64
        )
    )
        return null
    if ((provider === "hll_crcon") !== (gameId === "hell_let_loose"))
        return null
    if (
        provider === "wardogs_public_directory" &&
        (new URL(origin).origin !== "https://api.wardogservers.com" ||
            secretRef !== null ||
            addresses.length > 0)
    )
        return null
    if (provider === "wardogs_warcon" && !UUID.test(providerServerId))
        return null
    return {
        ref,
        guildId,
        gameId,
        provider,
        providerServerId,
        origin,
        secretRef,
        allowedAddresses: addresses,
    }
}

let cached: { raw: string | undefined; sources: DataSource[] } | null = null

/**
 * The operator catalogue from its environment variable, read once per
 * isolate and per value. Throws the same error as `parseSources` on anything
 * the schema would refuse, so a bad catalogue still fails loudly.
 */
export function readOperatorSources(raw: string | undefined): DataSource[] {
    if (cached && cached.raw === raw) return cached.sources
    let parsed: unknown
    try {
        parsed = raw ? JSON.parse(raw) : []
    } catch {
        throw new Error("Invalid game data source configuration.")
    }
    if (!Array.isArray(parsed) || parsed.length > MAX_SOURCES)
        throw new Error("Invalid game data source configuration.")
    const sources: DataSource[] = []
    for (const entry of parsed) {
        const source = readStoredSource(entry)
        if (!source) throw new Error("Invalid game data source configuration.")
        sources.push(source)
    }
    if (new Set(sources.map((source) => source.ref)).size !== sources.length)
        throw new Error("Invalid game data source configuration.")
    cached = { raw, sources }
    return sources
}
