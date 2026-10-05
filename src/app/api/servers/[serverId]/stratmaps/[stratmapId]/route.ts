import { NextResponse } from "next/server"

import { isDashboardWriteOrigin } from "@/lib/api/dashboard-write-origin"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { removeServerStratmap } from "@/lib/server-stratmaps"
import { logRouteError } from "@/lib/server-route-errors"

const json = (value: unknown, status = 200) =>
    NextResponse.json(value, {
        status,
        headers: { "Cache-Control": "no-store" },
    })

/**
 * Deletes a stratmap of this clan for the signed-in clan administrator. The
 * acting user comes from the session; Convex checks the administrator, that
 * the stratmap belongs to the clan, and removes it from the clan's events.
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ serverId: string; stratmapId: string }> }
) {
    if (!isDashboardWriteOrigin(request))
        return json({ error: "Forbidden." }, 403)
    const { serverId, stratmapId } = await params

    let result: Awaited<ReturnType<typeof removeServerStratmap>>
    try {
        result = await removeServerStratmap(serverId, stratmapId)
    } catch (error) {
        // Malformed IDs are rejected by the Convex validators.
        logRouteError("stratmaps.delete", error)
        return json({ error: "Stratmap not found." }, 404)
    }
    if (!result.ok)
        return result.error === "forbidden"
            ? json({ error: "Forbidden." }, 403)
            : json({ error: "Stratmap not found." }, 404)

    revalidateCacheEntries([
        appCacheTags.stratmap(stratmapId),
        appCacheTags.stratmaps(serverId),
        appCacheTags.serverContext(serverId),
        appCacheTags.events(serverId),
        appCacheTags.publicDiscovery(),
        ...result.detachedEventIds.map((eventId) =>
            appCacheTags.event(eventId)
        ),
    ])
    return json({ ok: true, detachedEvents: result.detachedEventIds.length })
}
