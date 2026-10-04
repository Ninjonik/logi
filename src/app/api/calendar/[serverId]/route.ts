import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"

import { buildICalendarFeed } from "@/domain/calendar/ical-feed"
import { getInternalAuthSecret } from "@/lib/env"

const getCalendarFeedReference = makeFunctionReference<"query">(
    "calendarFeed:getCalendarFeed"
)

export async function GET(
    request: Request,
    context: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await context.params
    const token = new URL(request.url).searchParams.get("token")
    if (!token) return new Response("Not found.", { status: 404 })

    const feed = await fetchQuery(getCalendarFeedReference, {
        secret: getInternalAuthSecret(),
        guildId: serverId as never,
        token,
    })
    if (!feed) return new Response("Not found.", { status: 404 })

    return new Response(buildICalendarFeed(feed), {
        headers: {
            "content-type": "text/calendar; charset=utf-8",
            "cache-control": "public, max-age=900",
        },
    })
}
