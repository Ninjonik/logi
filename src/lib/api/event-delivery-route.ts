import {
    discordUrl,
    type EventDiscordMessages,
} from "@/lib/read-models/match-detail"

type DeliveryAccess = {
    guildId: string
    event: {
        id: string
        announcementChannelId?: string
        isDraft?: boolean
    } | null
    configuredChannelId?: string
}

/** Authorize and scope the event before looking up any bot delivery state. */
export function eventDeliveryHandler(ports: {
    access(serverId: string, eventId: string): Promise<DeliveryAccess | null>
    messages(eventId: string): Promise<EventDiscordMessages | null>
}) {
    return async (
        _request: Request,
        params: { serverId: string; eventId: string }
    ) => {
        const headers = { "Cache-Control": "no-store" }
        try {
            const access = await ports.access(params.serverId, params.eventId)
            if (!access)
                return Response.json(
                    { error: "forbidden" },
                    { status: 403, headers }
                )
            if (!access.event || access.event.isDraft)
                return Response.json(
                    { error: "not_found" },
                    { status: 404, headers }
                )
            const messages = await ports.messages(access.event.id)
            const channelId =
                messages?.announcementChannelId ??
                access.event.announcementChannelId ??
                access.configuredChannelId
            const href =
                channelId && messages?.announcementMessageId
                    ? discordUrl(
                          access.guildId,
                          channelId,
                          messages.announcementMessageId
                      )
                    : null
            return Response.json(
                {
                    status: href
                        ? "delivered"
                        : channelId
                          ? "pending"
                          : "unavailable",
                    href,
                },
                { headers }
            )
        } catch {
            return Response.json(
                { error: "unavailable" },
                { status: 503, headers }
            )
        }
    }
}
