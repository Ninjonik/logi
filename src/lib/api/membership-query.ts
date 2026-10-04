import { isGameId } from "@/domain/games/game"
export function parseMembershipQuery(request: Request) {
    const url = new URL(request.url)
    const match = url.pathname.match(
        /^\/api\/v1\/clan\/membership-summaries\/(\d{17,20})\/?$/
    )
    if (
        !match ||
        [...url.searchParams.keys()].some(
            (key) =>
                !["game", "maxAgeMs"].includes(key) ||
                url.searchParams.getAll(key).length !== 1
        )
    )
        return null
    const gameId = url.searchParams.get("game")
    const age = url.searchParams.get("maxAgeMs") ?? "60000"
    if (!gameId || !isGameId(gameId) || !/^\d{1,6}$/.test(age)) return null
    const maxAgeMs = Number(age)
    if (maxAgeMs < 1000 || maxAgeMs > 300000) return null
    return { gameId, discordUserId: match[1], maxAgeMs }
}
