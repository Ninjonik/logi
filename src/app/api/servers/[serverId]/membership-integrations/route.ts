import { membershipPolicyHandlers } from "@/lib/api/membership-policy-route"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"
const handlers = membershipPolicyHandlers({
    origin: new URL(getSiteUrl()).origin,
    authorize: async (serverId) => {
        const context = await getServerContextUncached(serverId)
        return context?.canAdmin ? context.server.discordId : null
    },
    list: (guildId) =>
        fetchQuery(
            makeFunctionReference<"query">("memberObservations:listPolicies"),
            { secret: getInternalAuthSecret(), guildId }
        ),
    configure: (guildId, input) =>
        fetchMutation(
            makeFunctionReference<"mutation">(
                "memberObservations:configurePolicy"
            ),
            { secret: getInternalAuthSecret(), guildId, ...input }
        ),
})
type Context = { params: Promise<{ serverId: string }> }
export async function GET(request: Request, context: Context) {
    return handlers.GET(request, (await context.params).serverId)
}
export async function POST(request: Request, context: Context) {
    return handlers.POST(request, (await context.params).serverId)
}
