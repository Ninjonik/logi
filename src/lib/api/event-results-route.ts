import {
    resultCommandSchema,
    resultReviewSchema,
    resultRevisionSchema,
    type ResultCommand,
} from "../../domain/match-results/result-revision"
import { isGameId, type GameId } from "../../domain/games/game"
export type ResultScope = {
    guildId: string
    gameId: GameId
    eventId: string
    actorId: string
}
type Ports = {
    origin: string
    authorize(
        serverId: string,
        eventId: string,
        game: GameId
    ): Promise<ResultScope | null>
    read(scope: ResultScope): Promise<unknown>
    write(scope: ResultScope, command: ResultCommand): Promise<unknown>
}
const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
function game(request: Request) {
    const params = new URL(request.url).searchParams
    const value = params.get("game")
    return value && isGameId(value) && params.getAll("game").length === 1
        ? value
        : null
}
export function eventResultsHandlers(ports: Ports) {
    return {
        get: async (request: Request, serverId: string, eventId: string) => {
            const selected = game(request)
            if (!selected) return json({ error: "invalid_game" }, 400)
            try {
                const scope = await ports.authorize(serverId, eventId, selected)
                if (!scope) return json({ error: "forbidden" }, 403)
                const data = resultReviewSchema.parse(await ports.read(scope))
                if (
                    JSON.stringify(
                        await ports.authorize(serverId, eventId, selected)
                    ) !== JSON.stringify(scope)
                )
                    return json({ error: "forbidden" }, 403)
                return json(data)
            } catch {
                return json({ error: "unavailable" }, 503)
            }
        },
        post: async (request: Request, serverId: string, eventId: string) => {
            const selected = game(request)
            if (!selected) return json({ error: "invalid_game" }, 400)
            if (request.headers.get("origin") !== ports.origin)
                return json({ error: "forbidden" }, 403)
            try {
                const scope = await ports.authorize(serverId, eventId, selected)
                if (!scope) return json({ error: "forbidden" }, 403)
                const parsed = resultCommandSchema.safeParse(
                    await request.json().catch(() => null)
                )
                if (!parsed.success)
                    return json({ error: "invalid_result" }, 400)
                if (
                    JSON.stringify(
                        await ports.authorize(serverId, eventId, selected)
                    ) !== JSON.stringify(scope)
                )
                    return json({ error: "forbidden" }, 403)
                return json(
                    resultRevisionSchema.parse(
                        await ports.write(scope, parsed.data)
                    )
                )
            } catch (error) {
                return error instanceof Error &&
                    error.message.includes("revision conflict")
                    ? json({ error: "conflict" }, 409)
                    : json({ error: "unavailable" }, 503)
            }
        },
    }
}
