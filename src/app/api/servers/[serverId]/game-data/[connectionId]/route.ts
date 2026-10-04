import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { warconRouteResponse } from "@/lib/api/warcon-route"
import { getWarconData } from "@/lib/server-warcon"
export const runtime = "nodejs"
export async function GET(
    request: Request,
    context: { params: Promise<{ serverId: string; connectionId: string }> }
) {
    const { serverId, connectionId } = await context.params
    const access = await getServerContextUncached(serverId)
    const actor = await currentDashboardActor()
    if (!access?.canAdmin || !actor)
        return Response.json(
            { error: "Forbidden." },
            { status: 403, headers: { "Cache-Control": "no-store" } }
        )
    return warconRouteResponse(request, (query) =>
        getWarconData(access.server.discordId, connectionId, query, actor)
    )
}
