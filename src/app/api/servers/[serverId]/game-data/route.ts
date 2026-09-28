import { getServerContextUncached } from "@/lib/read-models/server-context"
import { gameDataHandlers } from "@/lib/api/game-data-route"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"

const handlers = gameDataHandlers({
    authorize: async (serverId) => {
        const context = await getServerContextUncached(serverId)
        return context?.canAdmin ? context.server.discordId : null
    },
    list: async (guildId) =>
        fetchQuery(makeFunctionReference<"query">("gameData:listConnections"), {
            secret: getInternalAuthSecret(),
            guildId,
        }),
    configure: async (guildId, input) =>
        fetchMutation(makeFunctionReference<"mutation">("gameData:configure"), {
            secret: getInternalAuthSecret(),
            guildId,
            ...input,
        }),
})
type Context = { params: Promise<{ serverId: string }> }
export async function GET(request: Request, context: Context) {
    return handlers.GET(request, (await context.params).serverId)
}
export async function POST(request: Request, context: Context) {
    return handlers.POST(request, (await context.params).serverId)
}
