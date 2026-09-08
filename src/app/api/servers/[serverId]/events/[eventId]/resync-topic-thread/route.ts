import { NextRequest, NextResponse } from "next/server"

import {
    getUserSafeErrorMessage,
    logRouteError,
} from "@/lib/server-route-errors"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { requestForumTopicResync } from "@/lib/server-events"
import { getServerContext } from "@/lib/server-context"

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ serverId: string; eventId: string }> }
) {
    try {
        const { serverId, eventId } = await params
        const context = await getServerContext(serverId)
        if (!context?.canAdmin)
            return NextResponse.json({ error: "Forbidden." }, { status: 403 })

        const event = context.events.find((item) => item.id === eventId)
        if (!event)
            return NextResponse.json(
                { error: "Event not found." },
                { status: 404 }
            )
        if (event.status === "concluded")
            return NextResponse.json(
                { error: "Concluded events cannot be resynced." },
                { status: 400 }
            )

        await requestForumTopicResync({ eventId })
        revalidateCacheEntries([
            appCacheTags.event(eventId),
            appCacheTags.events(serverId),
            appCacheTags.serverContext(serverId),
        ])
        return NextResponse.json({ ok: true })
    } catch (error) {
        logRouteError("events.resyncTopicThread", error)
        return NextResponse.json(
            {
                error: getUserSafeErrorMessage(
                    error,
                    "Unable to resync the topic thread."
                ),
            },
            { status: 400 }
        )
    }
}
