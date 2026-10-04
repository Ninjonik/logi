import {
    PEOPLE_RESOURCES,
    type PeopleResource,
} from "@/domain/api/people-summaries"
import { isGameId } from "@/domain/games/game"

export function parsePeopleQuery(request: Request) {
    const url = new URL(request.url),
        params = url.searchParams
    const path = /^\/api\/v1\/clan\/([^/]+)(?:\/([^/]+))?\/?$/.exec(
        url.pathname
    )
    const gameId = params.get("game")
    if (
        !path ||
        !(PEOPLE_RESOURCES as readonly string[]).includes(path[1]) ||
        params.getAll("game").length !== 1 ||
        !isGameId(gameId) ||
        [...params.keys()].some(
            (key) =>
                ![
                    "game",
                    ...(path[2] ? [] : ["cursor", "limit", "sort"]),
                ].includes(key)
        ) ||
        ["cursor", "limit", "sort"].some((key) => params.getAll(key).length > 1)
    )
        return null
    const limitText = params.get("limit") ?? "10",
        limit = Number(limitText),
        cursor = params.get("cursor")
    if (
        !/^\d{1,2}$/.test(limitText) ||
        limit < 1 ||
        limit > 10 ||
        (cursor !== null && (!cursor || cursor.length > 4096)) ||
        (params.has("sort") && params.get("sort") !== "createdAt")
    )
        return null
    let id: string | undefined
    try {
        id = path[2] ? decodeURIComponent(path[2]) : undefined
    } catch {
        return null
    }
    if (
        id !== undefined &&
        (!id || id.length > 200 || /[\s\x00-\x1f/]/.test(id))
    )
        return null
    return {
        resource: path[1] as PeopleResource,
        gameId: gameId!,
        id,
        limit,
        cursor,
    }
}
