import { refreshPerformanceHistory } from "@/lib/read-models/performance-history"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { getServerContext } from "@/lib/server-context"
import { handleIfNotLoggedIn } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await params
    await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/settings`)
    const context = await getServerContext(serverId)
    if (!context?.canAdmin)
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    try {
        const result = await refreshPerformanceHistory(context.server.discordId)
        revalidateCacheEntries([
            appCacheTags.matches(serverId),
            appCacheTags.serverContext(serverId),
        ])
        return NextResponse.json(result)
    } catch (error) {
        const message =
            error instanceof Error && error.message
                ? error.message
                : "Unable to refresh performance history."
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
