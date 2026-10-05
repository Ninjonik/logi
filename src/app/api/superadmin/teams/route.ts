import { superadminTeamsHandlers } from "@/lib/api/superadmin-teams-route"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { superadminAccess } from "@/lib/api/superadmin-route"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

export const runtime = "nodejs"

const handlers = superadminTeamsHandlers({
    origin: new URL(getSiteUrl()).origin,
    access: async () =>
        superadminAccess(
            await currentDashboardActor(),
            getInternalAuthSecret()
        ),
    get: async (access, teamId) =>
        await fetchQuery(makeFunctionReference<"query">("teams:adminGet"), {
            ...access,
            teamId,
        }),
    list: async (access, query) =>
        await fetchQuery(makeFunctionReference<"query">("teams:adminList"), {
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

/** `?teamId=` reads one catalogue record; otherwise `?game=` pages one game's catalogue. */
export async function GET(request: Request) {
    return handlers.GET(request)
}

/** `{ action: create | update | archive | restore | merge, ... }` for global administrators. */
export async function POST(request: Request) {
    return handlers.POST(request)
}
