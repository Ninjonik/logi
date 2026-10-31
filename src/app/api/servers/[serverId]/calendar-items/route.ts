import { NextResponse } from "next/server"

import { getServerContextUncached as getServerContext } from "@/lib/read-models/server-context"
import { isDashboardWriteOrigin } from "@/lib/api/dashboard-write-origin"
import { calendarItemCreateSchema } from "@/lib/validation/calendar-item"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { createCalendarItem } from "@/lib/gateways/calendar-items"
import { readBoundedJson } from "@/lib/api/request-json"
import { handleIfNotLoggedIn } from "@/lib/auth"

export async function POST(
    request: Request,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await params
    if (!isDashboardWriteOrigin(request)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }
    await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/calendar`)
    const context = await getServerContext(serverId)
    if (!context?.canAdmin) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }
    const parsed = calendarItemCreateSchema.safeParse(
        await readBoundedJson(request, 4096)
    )
    if (!parsed.success) {
        return NextResponse.json(
            {
                error:
                    parsed.error.issues[0]?.message ??
                    "Title and dates are required.",
            },
            { status: 400 }
        )
    }
    const body = parsed.data
    await createCalendarItem(context.server.discordId, body)
    revalidateCacheEntries([
        appCacheTags.server(serverId),
        appCacheTags.serverContext(serverId),
    ])
    return NextResponse.json({ ok: true })
}
