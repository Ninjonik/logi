import { NextResponse } from "next/server"

import { getServerContextUncached as getServerContext } from "@/lib/read-models/server-context"
import { isDashboardWriteOrigin } from "@/lib/api/dashboard-write-origin"
import { saveGuildFrontendSettings } from "@/lib/server-guild-settings"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
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

    const calendarItems = (context.server.calendarItems ?? []).filter(
        (item) => item.id !== itemId
    )
    if (calendarItems.length === (context.server.calendarItems ?? []).length) {
        return NextResponse.json(
            { error: "Calendar item not found." },
            { status: 404 }
        )
    }

    await saveGuildFrontendSettings({
        guildId: serverId,
        name: context.server.name,
        avatar: context.server.avatar,
        description: context.server.description,
        eventCategories: context.server.eventCategories,
        calendarItems,
    })
    revalidateCacheEntries([
        appCacheTags.server(serverId),
        appCacheTags.serverContext(serverId),
    ])
    return NextResponse.json({ ok: true })
}
