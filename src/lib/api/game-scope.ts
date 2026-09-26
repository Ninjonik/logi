import { DEFAULT_GAME_ID, isGameId, type GameScope } from "@/domain/games/game"

/** Parses the public API's game selector. Omitting it deliberately retains the
 * application's legacy Hell Let Loose default; `all` is explicit aggregation. */
export function parseApiGameScope(
    request: Request
): GameScope | { error: string } {
    const value = new URL(request.url).searchParams.get("game")
    if (value === null || value === "") return DEFAULT_GAME_ID
    if (value === "all" || isGameId(value)) return value
    return {
        error: "game must be hell_let_loose, hell_let_loose_vietnam, wardogs, or all.",
    }
}

export function isApiGameScopeError(
    scope: GameScope | { error: string }
): scope is { error: string } {
    return typeof scope === "object" && "error" in scope
}
