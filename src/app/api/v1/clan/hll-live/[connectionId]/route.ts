import {
    authenticateClanRequest,
    isAuthError,
} from "@/lib/api/authenticated-clan-route"
import { hllLiveRouteResponse } from "@/lib/api/hll-live-route"
import { getHllLive } from "@/lib/server-hll-live"
export const runtime = "nodejs"
export async function GET(
    request: Request,
    context: { params: Promise<{ connectionId: string }> }
) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) {
        auth.headers.set("Cache-Control", "no-store")
        return auth
    }
    const { connectionId } = await context.params
    return hllLiveRouteResponse(
        request,
        () => getHllLive(auth.guildId, connectionId, auth.key),
        auth.headers
    )
}
