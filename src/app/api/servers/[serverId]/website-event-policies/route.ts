import { websiteEventPolicyHandlers } from "@/lib/api/website-event-policy-route"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"
import { getSession } from "@/lib/auth"

export const runtime = "nodejs"
const handlers = websiteEventPolicyHandlers({
    origin: new URL(getSiteUrl()).origin,
    session: getSession,
    configure: (sid, workspaceId, input) =>
        fetchMutation(
            makeFunctionReference<"mutation">(
                "websiteEventCommands:configurePolicy"
            ),
            { secret: getInternalAuthSecret(), sid, workspaceId, ...input }
        ),
    list: (sid, workspaceId, applicationRecordId) =>
        fetchQuery(
            makeFunctionReference<"query">("websiteEventCommands:listPolicies"),
            {
                secret: getInternalAuthSecret(),
                sid,
                workspaceId,
                applicationRecordId,
            }
        ),
})
type Context = { params: Promise<{ serverId: string }> }
export async function POST(request: Request, context: Context) {
    return handlers.POST(request, (await context.params).serverId)
}
export async function GET(request: Request, context: Context) {
    return handlers.GET(request, (await context.params).serverId)
}
