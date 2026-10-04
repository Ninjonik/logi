import {
    credentialEncryption,
    newSourceRef,
    testGameServerConnection,
} from "@/lib/gateways/game-server-credentials"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { gameDataSourceHandlers } from "@/lib/api/game-data-sources-route"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string }> }

/** Every Convex call carries the actor so the transaction re-checks the session and admin rights. */
async function access(guildId: string) {
    const actor = await currentDashboardActor()
    if (!actor) throw new Error("Forbidden.")
    return { secret: getInternalAuthSecret(), guildId, actor }
}
const mutation = (name: string) => makeFunctionReference<"mutation">(name)

const handlers = gameDataSourceHandlers({
    authorize: async (serverId) => {
        const [server, actor] = await Promise.all([
            getServerContextUncached(serverId),
            currentDashboardActor(),
        ])
        return server?.canAdmin && actor
            ? { guildId: server.server.discordId }
            : null
    },
    list: async (guildId) =>
        fetchQuery(
            makeFunctionReference<"query">("gameDataSources:list"),
            await access(guildId)
        ),
    reserveTest: async (guildId, ref) =>
        fetchMutation(mutation("gameDataSources:reserveTest"), {
            ...(await access(guildId)),
            ref,
        }),
    create: async (guildId, input) =>
        fetchMutation(mutation("gameDataSources:create"), {
            ...(await access(guildId)),
            ...input,
        }),
    setCredential: async (guildId, input) =>
        fetchMutation(mutation("gameDataSources:setCredential"), {
            ...(await access(guildId)),
            ...input,
        }),
    command: async (guildId, name, input) =>
        fetchMutation(mutation(`gameDataSources:${name}`), {
            ...(await access(guildId)),
            ...input,
        }),
    testStored: async (guildId, ref) =>
        fetchAction(
            makeFunctionReference<"action">(
                "gameDataCredentialActions:testStored"
            ),
            { ...(await access(guildId)), ref }
        ),
    encryption: credentialEncryption,
    testConnection: testGameServerConnection,
    newRef: newSourceRef,
})

export async function GET(_request: Request, context: Context) {
    return handlers.GET((await context.params).serverId)
}
export async function POST(request: Request, context: Context) {
    return handlers.POST(request, (await context.params).serverId)
}
