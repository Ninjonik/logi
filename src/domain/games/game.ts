/** Stable persistence identifiers. Missing legacy values are Hell Let Loose. */
export const GAME_IDS = [
    "hell_let_loose",
    "hell_let_loose_vietnam",
    "wardogs",
    "world_of_warcraft_forever",
] as const

/**
 * Platform catalogue IDs are opaque strings. `GAME_IDS` retains the built-in
 * legacy IDs for migrations and offline fallbacks, but does not restrict a
 * superadmin-created game.
 */
export type KnownGameId = (typeof GAME_IDS)[number]
export type GameId = string
export type GameScope = GameId | "all"
/** A read scope may select one game, every game, or an explicit set of games. */
export type GameSelection = GameScope | readonly GameId[]

export const DEFAULT_GAME_ID: GameId = "hell_let_loose"

export const GAME_LABELS: Record<string, string> = {
    hell_let_loose: "Hell Let Loose",
    hell_let_loose_vietnam: "Hell Let Loose: Vietnam",
    wardogs: "Wardogs",
    world_of_warcraft_forever: "World of Warcraft: Forever",
}

/** Built-ins have translated product names; custom catalogue games fall back to their ID. */
export function gameLabel(gameId: GameId) {
    return GAME_LABELS[gameId] ?? gameId
}

export function isGameId(value: string | null | undefined): value is GameId {
    return Boolean(value?.trim())
}

export function resolveGameScope(gameId?: GameId): GameId {
    return gameId ?? DEFAULT_GAME_ID
}

export function matchesGameScope(
    gameId: GameId | undefined,
    scope?: GameSelection
) {
    if (!scope || scope === "all") return true
    const resolvedGameId = resolveGameScope(gameId)
    return Array.isArray(scope)
        ? scope.includes(resolvedGameId)
        : resolvedGameId === scope
}

/** Filters game-owned records while treating missing legacy values as HLL. */
export function filterByGameScope<T extends { gameId?: GameId }>(
    records: readonly T[],
    scope?: GameSelection
) {
    return records.filter((record) => matchesGameScope(record.gameId, scope))
}

/** Applies a game override without making absent overrides erase clan defaults. */
export function withGameOverrides<T extends object>(
    defaults: T,
    overrides: Partial<Record<GameId, Partial<T>>> | undefined,
    gameId?: GameId
): T {
    return gameId ? { ...defaults, ...overrides?.[gameId] } : defaults
}
