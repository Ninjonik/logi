import { getServerContextUncached } from "@/lib/read-models/server-context"
import { getEventDiscordMessages } from "@/lib/read-models/match-detail"
import { eventDeliveryHandler } from "@/lib/api/event-delivery-route"
import { withGameOverrides } from "@/domain/games/game"

const handler = eventDeliveryHandler({
    access: async (serverId, eventId) => {
        const context = await getServerContextUncached(serverId)
        if (!context?.canAdmin) return null
        const event =
            context.events.find((event) => event.id === eventId) ?? null
        const config =
            event && context.discordConfig
                ? withGameOverrides(
                      context.discordConfig,
                      context.discordConfig.gameOverrides,
                      event.gameId
                  )
                : null
        return {
            guildId: context.server.discordId,
            event,
            configuredChannelId: config?.announcementsChannelId,
        }
    },
    messages: getEventDiscordMessages,
})

export async function GET(
    request: Request,
    { params }: { params: Promise<{ serverId: string; eventId: string }> }
) {
    return handler(request, await params)
}
