import { superadminTeamRequestsHandlers } from "@/lib/api/superadmin-team-requests-route"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { superadminAccess } from "@/lib/api/superadmin-route"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

export const runtime = "nodejs"

const handlers = superadminTeamRequestsHandlers({
    origin: new URL(getSiteUrl()).origin,
    access: async () =>
        superadminAccess(
            await currentDashboardActor(),
            getInternalAuthSecret()
        ),
    get: async (access, requestId) =>
        await fetchQuery(makeFunctionReference<"query">("teamRequests:get"), {
            ...access,
            requestId,
        }),
    queue: async (access, query) =>
        await fetchQuery(makeFunctionReference<"query">("teamRequests:queue"), {
            ...access,
            status: query.status,
            cursor: query.cursor,
            limit: query.limit,
        }),
    decide: async (access, body) =>
        await fetchMutation(
            makeFunctionReference<"mutation">("teamRequests:decide"),
            { ...access, requestId: body.requestId, input: body.decision }
        ),
})

/** `?requestId=` reads one request; otherwise `?status=` pages the moderation queue. */
export async function GET(request: Request) {
    return handlers.GET(request)
}

/** `{ requestId, decision }` approves, merges or rejects one pending request. */
export async function POST(request: Request) {
    return handlers.POST(request)
}
