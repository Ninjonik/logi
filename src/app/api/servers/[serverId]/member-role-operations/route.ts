import { memberRoleOperationsHandler } from "@/lib/api/member-role-operations-route"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { fetchQuery } from "convex/nextjs"

const handle = memberRoleOperationsHandler({
    authorize: async (serverId) => {
        const context = await getServerContextUncached(serverId)
        return context?.canAdmin ? context.server.discordId : null
    },
    list: (guildId) =>
        fetchQuery(
            makeFunctionReference<"query">("memberRoleOperations:listForGuild"),
            { secret: getInternalAuthSecret(), guildId }
        ),
})
export async function GET(
    request: Request,
    context: { params: Promise<{ serverId: string }> }
) {
    return handle(request, (await context.params).serverId)
}
