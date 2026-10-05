import {
    eventExcusesHandler,
    type EventExcusesResult,
} from "@/lib/api/event-excuses-route"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { makeFunctionReference } from "convex/server"
import { fetchMutation } from "convex/nextjs"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string; eventId: string }> }
const setExcuses = makeFunctionReference<"mutation">(
    "eventAttendance:setExcuses"
)

const handler = eventExcusesHandler({
    origin: new URL(getSiteUrl()).origin,
    access: async (serverId) => {
        const [server, actor] = await Promise.all([
            getServerContextUncached(serverId),
            currentDashboardActor(),
        ])
        return server?.canAdmin && actor
            ? {
                  guildId: server.server.discordId,
                  actorDiscordId: actor.subject,
              }
            : null
    },
    save: async (input) =>
        (await fetchMutation(setExcuses, {
            secret: getInternalAuthSecret(),
            ...input,
        })) as EventExcusesResult,
    revalidate: (serverId, eventId) =>
        revalidateCacheEntries([
            appCacheTags.serverContext(serverId),
            appCacheTags.events(serverId),
            appCacheTags.event(eventId),
        ]),
})

/** A clan admin excuses roster players after the match (design E3). */
export async function POST(request: Request, context: Context) {
    return handler(request, await context.params)
}
