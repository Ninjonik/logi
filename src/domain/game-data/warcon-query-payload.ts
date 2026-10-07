import type { WarconQuery, WarconView } from "./warcon-query"

/**
 * The Warcon query as `warconData:read` passes it to the cache mutations,
 * already parsed and normalised with `warconQuerySchema` in the action. The
 * mutations run on every panel refresh and API read, so they read it back
 * through this guard instead of Zod (ARCHITECTURE.md, "Convex hot paths").
 */
export const WARCON_VIEWS = [
    "live",
    "analytics",
    "cash",
    "matches",
    "match",
    "leaderboard",
    "players",
    "career",
    "kills",
    "catalog",
    "rotation",
    "health",
    "capabilities",
    "experiences",
    "alternators",
] as const satisfies readonly WarconView[]

const KEYS: Record<WarconView, readonly string[]> = {
    live: [],
    analytics: ["range"],
    cash: ["since"],
    matches: ["page"],
    match: ["matchId"],
    leaderboard: ["range", "sort", "dir", "page", "minMinutes"],
    players: ["q", "since", "sort", "dir", "offset", "limit"],
    career: ["steamId"],
    kills: [
        "limit",
        "before",
        "beforeTime",
        "match",
        "player",
        "killer",
        "victim",
        "cause",
        "kind",
        "minM",
    ],
    catalog: [],
    rotation: [],
    health: [],
    capabilities: [],
    experiences: ["map"],
    alternators: ["map"],
}

export function isWarconView(value: unknown): value is WarconView {
    return (WARCON_VIEWS as readonly unknown[]).includes(value)
}

/** A query of a known view whose fields the schema allows; null for anything else. */
export function readWarconQueryPayload(json: string): WarconQuery | null {
    let value: unknown
    try {
        value = JSON.parse(json)
    } catch {
        return null
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const record = value as Record<string, unknown>
    if (!isWarconView(record.view)) return null
    const allowed = KEYS[record.view]
    for (const [key, field] of Object.entries(record)) {
        if (key === "view") continue
        if (!allowed.includes(key)) return null
        if (typeof field !== "string" && typeof field !== "number") return null
    }
    return value as WarconQuery
}

export function warconCacheMs(_query: Pick<WarconQuery, "view">) {
    return 60_000
}
