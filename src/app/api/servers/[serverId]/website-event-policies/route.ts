import { websiteEventPolicyHandlers } from "@/lib/api/website-event-policy-route"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { getSession } from "@/lib/auth"

export const runtime = "nodejs"
const handlers = websiteEventPolicyHandlers({
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
