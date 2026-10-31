import { NextResponse } from "next/server"

import { getServerContextUncached as getServerContext } from "@/lib/read-models/server-context"
import { isDashboardWriteOrigin } from "@/lib/api/dashboard-write-origin"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { removeCalendarItem } from "@/lib/gateways/calendar-items"
import { handleIfNotLoggedIn } from "@/lib/auth"

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ serverId: string; itemId: string }> }
) {
    const { serverId, itemId } = await params
    if (!isDashboardWriteOrigin(request)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }
    await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/calendar`)
    const context = await getServerContext(serverId)
    if (!context?.canAdmin) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    if (!(await removeCalendarItem(context.server.discordId, itemId))) {
        return NextResponse.json(
            { error: "Calendar item not found." },
            { status: 404 }
        )
    }
    revalidateCacheEntries([
        appCacheTags.server(serverId),
        appCacheTags.serverContext(serverId),
    ])
    return NextResponse.json({ ok: true })
}
