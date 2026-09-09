/** Stable persistence identifiers. Missing legacy values are Hell Let Loose. */
export const GAME_IDS = [
    "hell_let_loose",
    "hell_let_loose_vietnam",
    "wardogs",
] as const

export type GameId = (typeof GAME_IDS)[number]
export type GameScope = GameId | "all"

export const DEFAULT_GAME_ID: GameId = "hell_let_loose"

export const GAME_LABELS: Record<GameId, string> = {
    hell_let_loose: "Hell Let Loose",
    hell_let_loose_vietnam: "Hell Let Loose: Vietnam",
    wardogs: "Wardogs",
}

export function isGameId(value: string | null | undefined): value is GameId {
    return Boolean(value && GAME_IDS.includes(value as GameId))
}

export function resolveGameScope(gameId?: GameId): GameId {
    return gameId ?? DEFAULT_GAME_ID
}

export function matchesGameScope(
    gameId: GameId | undefined,
    scope?: GameScope
) {
    return !scope || scope === "all" || resolveGameScope(gameId) === scope
}

/** Filters game-owned records while treating missing legacy values as HLL. */
export function filterByGameScope<T extends { gameId?: GameId }>(
    records: readonly T[],
    scope?: GameScope
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
