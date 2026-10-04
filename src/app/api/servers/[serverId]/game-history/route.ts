import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { handleGameHistoryRead } from "@/lib/api/game-history-route"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { fetchQuery } from "convex/nextjs"

export const runtime = "nodejs"
export async function GET(
    request: Request,
    context: { params: Promise<{ serverId: string }> }
) {
    const server = await getServerContextUncached(
        (await context.params).serverId
    )
    const actor = await currentDashboardActor()
    if (!server?.canAdmin || !actor)
        return Response.json(
            { error: { code: "forbidden" } },
            { status: 403, headers: { "Cache-Control": "no-store" } }
        )
    const guildId = server.server.discordId,
        secret = getInternalAuthSecret()
    return handleGameHistoryRead(request, {
        guildId,
        binding: `actor:${actor.sid}:${actor.subject}`,
        secret,
        read: (input) =>
            fetchQuery(
                makeFunctionReference<"query">("gameHistoryReads:read"),
                { ...input, guildId, secret, actor }
            ),
    })
}
