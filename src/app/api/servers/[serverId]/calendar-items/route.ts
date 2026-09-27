import { NextResponse } from "next/server"

import { saveGuildFrontendSettings } from "@/lib/server-guild-settings"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { getServerContext } from "@/lib/server-context"
import { handleIfNotLoggedIn } from "@/lib/auth"

export async function POST(
    request: Request,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await params
    await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/calendar`)
    const context = await getServerContext(serverId)
    if (!context?.canAdmin) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }
    const body = (await request.json()) as {
        title?: string
        startAt?: string
        endAt?: string
        allDay?: boolean
    }
    if (!body.title?.trim() || !body.startAt || !body.endAt) {
        return NextResponse.json(
            { error: "Title and dates are required." },
            { status: 400 }
        )
    }
    await saveGuildFrontendSettings({
        guildId: serverId,
        name: context.server.name,
        avatar: context.server.avatar,
        description: context.server.description,
        eventCategories: context.server.eventCategories,
        calendarItems: [
            ...(context.server.calendarItems ?? []),
            {
                id: `calendar-item-${crypto.randomUUID()}`,
                guildId: serverId,
                title: body.title.trim(),
                color: "#7c3aed",
                startAt: body.startAt,
                endAt: body.endAt,
                allDay: Boolean(body.allDay),
                createdAt: "",
                updatedAt: "",
            },
        ],
    })
    revalidateCacheEntries([
        appCacheTags.server(serverId),
        appCacheTags.serverContext(serverId),
    ])
    return NextResponse.json({ ok: true })
}
