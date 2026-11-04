import { withGameOverrides } from "@/domain/games/game"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { getEventDiscordMessages, discordUrl } from "@/lib/read-models/match-detail"

export async function GET(_request: Request, { params }: { params: Promise<{ serverId: string; eventId: string }> }) {
    const { serverId, eventId } = await params
    const context = await getServerContextUncached(serverId)
    if (!context?.canAdmin) return Response.json({ error: "forbidden" }, { status: 403 })
    const event = context.events.find((event) => event.id === eventId)
    if (!event || event.isDraft) return Response.json({ error: "not_found" }, { status: 404 })
    const config = context.discordConfig ? withGameOverrides(context.discordConfig, context.discordConfig.gameOverrides, event.gameId) : null
    const messages = await getEventDiscordMessages(event.id)
    const channelId = messages?.announcementChannelId ?? event.announcementChannelId ?? config?.announcementsChannelId
    const href = channelId && messages?.announcementMessageId ? discordUrl(context.server.discordId, channelId, messages.announcementMessageId) : null
    return Response.json({ status: href ? "delivered" : channelId ? "pending" : "unavailable", href }, { headers: { "Cache-Control": "no-store" } })
}
