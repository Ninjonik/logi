import { getServerContextUncached } from "@/lib/read-models/server-context"
import { eventResultsHandlers } from "@/lib/api/event-results-route"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { resolveGameScope } from "@/domain/games/game"
import { makeFunctionReference } from "convex/server"
import { getSession } from "@/lib/auth"
function handlers() {
    return eventResultsHandlers({
        origin: getSiteUrl().replace(/\/$/, ""),
        authorize: async (serverId, eventId, gameId) => {
            const session = await getSession()
            if (!session) return null
            const context = await getServerContextUncached(serverId)
            const event = context?.events.find(
                (e) =>
                    e.id === eventId &&
                    resolveGameScope(e.gameId) === gameId &&
                    (e.kind ?? "match") === "match"
            )
            return context?.canAdmin && event
                ? {
                      guildId: context.server.discordId,
                      gameId,
                      eventId,
                      actorId: session.sub,
                  }
                : null
        },
        read: (scope) =>
            fetchQuery(makeFunctionReference<"query">("eventResults:get"), {
                secret: getInternalAuthSecret(),
                ...scope,
            }),
        write: (scope, command) =>
            fetchMutation(
                makeFunctionReference<"mutation">("eventResults:review"),
                { secret: getInternalAuthSecret(), ...scope, command }
            ),
    })
}
type Context = { params: Promise<{ serverId: string; eventId: string }> }
export async function GET(request: Request, context: Context) {
    const { serverId, eventId } = await context.params
    return handlers().get(request, serverId, eventId)
}
export async function POST(request: Request, context: Context) {
    const { serverId, eventId } = await context.params
    return handlers().post(request, serverId, eventId)
}
