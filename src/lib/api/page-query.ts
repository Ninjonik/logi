import { isApiGameScopeError, parseApiGameScope } from "./game-scope"
import type { GameSelection } from "@/domain/games/game"

export const API_PAGE_DEFAULT_LIMIT = 25
export const API_PAGE_MAX_LIMIT = 100

export type ApiPageQuery = {
    limit: number
    cursor: string | null
    game: GameSelection
    /** The only currently supported list order; Convex cursors use this order. */
    sort: "createdAt"
    updatedSince?: string
}

export type ApiPageQueryError = { error: string }

export function parseApiPageQuery(
    request: Request,
    options: { gameOwned: boolean; supportsUpdatedSince?: boolean }
): ApiPageQuery | ApiPageQueryError {
    const params = new URL(request.url).searchParams
    const limitValue = params.get("limit")
    const limit =
        limitValue === null ? API_PAGE_DEFAULT_LIMIT : Number(limitValue)
    if (!Number.isInteger(limit) || limit < 1 || limit > API_PAGE_MAX_LIMIT)
        return { error: "limit must be an integer between 1 and 100." }

    const cursor = params.get("cursor")
    if (cursor !== null && (!cursor || cursor.length > 2_048))
        return { error: "cursor is invalid." }

    // Do not silently accept a future sort option: a cursor only has meaning for
    // the exact stable order that created it. Creation order is Convex's native
    // pagination order and is stable for a resource query.
    const sort = params.get("sort")
    if (sort !== null && sort !== "createdAt")
        return { error: "sort must be createdAt." }

    const gameValues = params.getAll("game")
    if (gameValues.length) {
        if (!options.gameOwned)
            return { error: "game is not supported by this resource." }
    }
    const game = parseApiGameScope(request)
    if (isApiGameScopeError(game)) return game

    const updatedSince = params.get("updatedSince")
    if (updatedSince !== null) {
        if (!options.supportsUpdatedSince)
            return { error: "updatedSince is not supported by this resource." }
        if (
            !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(updatedSince) ||
            Number.isNaN(Date.parse(updatedSince))
        )
            return { error: "updatedSince must be an ISO timestamp." }
    }
    return {
        limit,
        cursor,
        sort: "createdAt",
        game,
        ...(updatedSince ? { updatedSince } : {}),
    }
}

export function isApiPageQueryError(
    value: ApiPageQuery | ApiPageQueryError
): value is ApiPageQueryError {
    return "error" in value
}
