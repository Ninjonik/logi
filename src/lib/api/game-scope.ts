import {
    DEFAULT_GAME_ID,
    isGameId,
    type GameSelection,
} from "@/domain/games/game"

/** Parses the public API's game selector. Omitting it deliberately retains the
 * application's legacy Hell Let Loose default; `all` is explicit aggregation. */
export function parseApiGameScope(
    request: Request
): GameSelection | { error: string } {
    const values = new URL(request.url).searchParams
        .getAll("game")
        .flatMap((value) => value.split(","))
        .filter(Boolean)
    if (!values.length) return DEFAULT_GAME_ID
    if (values.includes("all"))
        return values.length === 1
            ? "all"
            : { error: "game=all cannot be combined with specific games." }
    if (values.every(isGameId)) {
        const games = [...new Set(values)]
        return games.length === 1 ? games[0]! : games
    }
    return {
        error: "game must be a supported game ID or all.",
    }
}

export function isApiGameScopeError(
    scope: GameSelection | { error: string }
): scope is { error: string } {
    return typeof scope === "object" && "error" in scope
}
