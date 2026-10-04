import {
    authenticateClanRequest,
    isAuthError,
} from "@/lib/api/authenticated-clan-route"
import { warconRouteResponse } from "@/lib/api/warcon-route"
import { getWarconData } from "@/lib/server-warcon"
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
    return warconRouteResponse(
        request,
        (query) => getWarconData(auth.guildId, connectionId, query, auth.key),
        auth.headers
    )
}
