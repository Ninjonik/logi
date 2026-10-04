import { matchTeamRefreshHandler } from "@/lib/api/match-team-refresh-route"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { TEAM_DASHBOARD_RATE_LIMIT } from "@/lib/api/teams-dashboard-route"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { checkPublicApiRateLimit } from "@/lib/public-api"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { fetchMutation } from "convex/nextjs"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string; eventId: string }> }
const refreshSnapshot = makeFunctionReference<"mutation">(
    "matchTeams:refreshSnapshot"
)

const handler = matchTeamRefreshHandler({
    access: async (serverId) => {
        const [server, actor] = await Promise.all([
            getServerContextUncached(serverId),
            currentDashboardActor(),
        ])
        return server?.canAdmin && actor
            ? {
                  serverRecordId: server.server.id,
                  guildId: server.server.discordId,
                  actor: actor.subject,
              }
            : null
    },
    rateLimit: async (bucket) => {
        const value = await checkPublicApiRateLimit(
            bucket,
            TEAM_DASHBOARD_RATE_LIMIT
        )
        return {
            allowed: value.allowed,
            retryAfterSeconds: (value.resetAt - Date.now()) / 1000,
        }
    },
    refresh: async (input) =>
        await fetchMutation(refreshSnapshot, {
            secret: getInternalAuthSecret(),
            serverId: input.serverRecordId as never,
            eventId: input.eventId as never,
            teamId: input.teamId,
            actor: input.actor,
        }),
    revalidate: (serverId, eventId) =>
        revalidateCacheEntries([
            appCacheTags.serverContext(serverId),
            appCacheTags.events(serverId),
            appCacheTags.event(eventId),
            appCacheTags.rosterImageEvent(eventId),
        ]),
})

/** Explicit, audited re-capture of one assigned team's presentation before a match concludes. */
export async function POST(request: Request, context: Context) {
    return await handler(request, await context.params)
}
