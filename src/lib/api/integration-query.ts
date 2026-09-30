import { SYNC_RESOURCES, type SyncResource } from "@/domain/integrations/change"
import { isGameId } from "@/domain/games/game"

/** Strict single-game, explicit-resource contract shared by the guard and handler. */
export function parseIntegrationQuery(request: Request) {
    const url = new URL(request.url),
        params = url.searchParams
    const path = url.pathname.match(
        /^\/api\/v1\/clan\/(changes|sync-records)(?:\/([^/]+)\/([^/]+))?\/?$/
    )
    if (
        !path ||
        params.getAll("game").length !== 1 ||
        !isGameId(params.get("game") ?? "")
    )
        return null
    const gameId = params.get("game") as
        "hell_let_loose" | "hell_let_loose_vietnam" | "wardogs"
    if (path[1] === "sync-records") {
        if (
            !path[2] ||
            !path[3] ||
            !(SYNC_RESOURCES as readonly string[]).includes(path[2]) ||
            (path[2] === "membership-summaries" &&
                !/^\d{17,20}$/.test(path[3])) ||
            [...params.keys()].some((key) => key !== "game")
        )
            return null
        let id: string
        try {
            id = decodeURIComponent(path[3])
        } catch {
            return null
        }
        return {
            kind: "record" as const,
            gameId,
            resources: [path[2] as SyncResource],
            id,
        }
    }
    if (
        path[2] ||
        params.getAll("resources").length !== 1 ||
        [...params.keys()].some(
            (key) =>
                ![
                    "game",
                    "resources",
                    "cursor",
                    "start",
                    "limit",
                    "subject",
                ].includes(key)
        ) ||
        ["cursor", "start", "limit", "subject"].some(
            (key) => params.getAll(key).length > 1
        )
    )
        return null
    const resources = params
        .get("resources")!
        .split(",")
        .sort() as SyncResource[]
    if (
        !resources.length ||
        resources.length > SYNC_RESOURCES.length ||
        new Set(resources).size !== resources.length ||
        resources.some((resource) => !SYNC_RESOURCES.includes(resource))
    )
        return null
    const limitText = params.get("limit") ?? "25",
        limit = Number(limitText)
    if (!/^\d{1,3}$/.test(limitText) || limit < 1 || limit > 100) return null
    const discordUserId = params.get("subject")
    if (
        resources.includes("membership-summaries")
            ? !discordUserId || !/^\d{17,20}$/.test(discordUserId)
            : !!discordUserId
    )
        return null
    const startNow = params.get("start") === "now",
        cursor = params.get("cursor")
    if (
        (params.has("start") && !startNow) ||
        startNow === !!cursor ||
        (cursor?.length ?? 0) > 4096
    )
        return null
    return {
        kind: "changes" as const,
        gameId,
        resources,
        limit,
        startNow,
        cursor,
        discordUserId,
    }
}
