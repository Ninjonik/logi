import {
    TEAM_DASHBOARD_RATE_LIMIT,
    teamsDashboardHandlers,
} from "@/lib/api/teams-dashboard-route"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { checkPublicApiRateLimit } from "@/lib/public-api"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string }> }

const handlers = teamsDashboardHandlers({
    origin: new URL(getSiteUrl()).origin,
    access: async (serverId) => {
        const server = await getServerContextUncached(serverId),
            actor = await currentDashboardActor()
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
    get: async (access, teamId) =>
        await fetchQuery(makeFunctionReference<"query">("teams:get"), {
            ...access,
            teamId,
        }),
    list: async (access, query) =>
        await fetchQuery(makeFunctionReference<"query">("teams:list"), {
            ...access,
            gameId: query.gameId,
            archived: query.archived,
            ...(query.search ? { search: query.search } : {}),
            cursor: query.cursor,
            limit: query.limit,
        }),
    command: async (access, mutation, payload) =>
        await fetchMutation(makeFunctionReference<"mutation">(mutation), {
            ...access,
            ...payload,
        }),
})

/** `?teamId=` reads one record as `{ team }`; otherwise `?game=` pages one game's directory. */
export async function GET(request: Request, context: Context) {
    return handlers.GET(request, (await context.params).serverId)
}

export async function POST(request: Request, context: Context) {
    return handlers.POST(request, (await context.params).serverId)
}
