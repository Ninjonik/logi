import type { GameId } from "@/domain/games/game"

/**
 * A clan setting applies to every game unless a game has an exception: its own
 * value stored under `gameOverrides[game]`. These helpers read and write one
 * setting's exceptions without touching a game's other stored settings.
 */
export type GameOverrides<O extends object> = Partial<
    Record<GameId, Partial<O>>
>

/** Channel settings a game can route somewhere other than the clan-wide one. */
export const GAME_EXCEPTION_CHANNEL_FIELDS = [
    "announcementsChannelId",
    "eventInfoChannelId",
    "forumCategoryId",
    "meetingChannelId",
    "squadVoiceCategoryId",
] as const

export type GameExceptionChannelField =
    (typeof GAME_EXCEPTION_CHANNEL_FIELDS)[number]

/** Empty values (a cleared picker, an emptied list) mean "use the clan-wide one". */
function isSet(value: unknown) {
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== null && value !== ""
}

/** The enabled games that use their own value for `field`. */
export function gameExceptions<O extends object, K extends keyof O>(
    overrides: GameOverrides<O> | undefined,
    field: K,
    enabledGames: readonly GameId[]
): Partial<Record<GameId, Partial<O>[K]>> {
    const exceptions: Partial<Record<GameId, Partial<O>[K]>> = {}
    for (const game of enabledGames) {
        const value = overrides?.[game]?.[field]
        if (isSet(value)) exceptions[game] = value
    }
    return exceptions
}

/**
 * Exceptions are offered when the clan plays more than one game. A clan with one
 * game still sees an exception stored earlier, so it can remove it: otherwise
 * that game would silently ignore the clan-wide value.
 */
export function showsGameExceptions(
    enabledGames: readonly GameId[],
    exceptions: Partial<Record<GameId, unknown>>[]
) {
    return (
        enabledGames.length > 1 ||
        exceptions.some((entry) => Object.keys(entry).length > 0)
    )
}

/**
 * Writes one setting's exceptions for the enabled games. An enabled game
 * without an exception (or with an empty one) falls back to the clan-wide
 * value. A game's other settings and every disabled game's settings stay as
 * they are, and a game left with no settings at all is dropped.
 */
export function withGameExceptions<O extends object, K extends keyof O>(
    overrides: GameOverrides<O> | undefined,
    field: K,
    exceptions: Partial<Record<GameId, Partial<O>[K]>>,
    enabledGames: readonly GameId[]
): GameOverrides<O> {
    const next: GameOverrides<O> = { ...overrides }
    for (const game of enabledGames) {
        const entry: Partial<O> = { ...next[game] }
        const value = exceptions[game]
        if (isSet(value)) entry[field] = value
        else delete entry[field]
        if (Object.keys(entry).length > 0) next[game] = entry
        else delete next[game]
    }
    return next
}
