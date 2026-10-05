import { teamRequestsDashboardHandlers } from "@/lib/api/team-requests-route"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { TEAM_DASHBOARD_RATE_LIMIT } from "@/lib/api/teams-dashboard-route"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { checkPublicApiRateLimit } from "@/lib/public-api"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string }> }

const handlers = teamRequestsDashboardHandlers({
    origin: new URL(getSiteUrl()).origin,
    access: async (serverId) => {
        const [server, actor] = await Promise.all([
            getServerContextUncached(serverId),
            currentDashboardActor(),
        ])
        return server?.canAdmin && actor
            ? {
                  secret: getInternalAuthSecret(),
                  guildId: server.server.discordId,
                  actor,
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
    list: async (access, query) =>
        await fetchQuery(
            makeFunctionReference<"query">("teamRequests:listMine"),
            { ...access, cursor: query.cursor, limit: query.limit }
        ),
    submit: async (access, input) =>
        await fetchMutation(
            makeFunctionReference<"mutation">("teamRequests:submit"),
            { ...access, input }
        ),
    cancel: async (access, requestId) =>
        await fetchMutation(
            makeFunctionReference<"mutation">("teamRequests:cancel"),
            { ...access, requestId }
        ),
})

/** This workspace's team requests, newest first; `?cursor=` continues a page. */
export async function GET(request: Request, context: Context) {
    return handlers.GET(request, (await context.params).serverId)
}

/** `{ action: "submit", input }` or `{ action: "cancel", requestId }`; same-origin only. */
export async function POST(request: Request, context: Context) {
    return handlers.POST(request, (await context.params).serverId)
}
