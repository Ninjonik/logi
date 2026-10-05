import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { createClanAdminWriteGuard } from "@/lib/api/clan-admin-write"
import { getSiteUrl } from "@/lib/env"

/** Current clan admin with a live dashboard session, read without the dashboard cache. */
async function canAdminServer(serverId: string) {
    const [context, actor] = await Promise.all([
        getServerContextUncached(serverId),
        currentDashboardActor(),
    ])
    return Boolean(context?.canAdmin && actor)
}

/** Origin and clan-admin check for browser writes under `/api/servers/[serverId]`. */
export function clanAdminWriteDenied(request: Request, serverId: string) {
    return createClanAdminWriteGuard({
        origin: new URL(getSiteUrl()).origin,
        canAdminServer,
    })(request, serverId)
}
