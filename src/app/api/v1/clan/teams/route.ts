import {
    parseTeamCollectionQuery,
    teamErrorResponse,
    type TeamCollectionQuery,
} from "@/lib/api/teams-route"
import {
    authenticateClanRequest,
    isAuthError,
} from "@/lib/api/authenticated-clan-route"
import { teamPageSchema, type TeamPage } from "@/domain/teams/team"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { hashApiKey } from "@/lib/public-api"
import { fetchQuery } from "convex/nextjs"
export const runtime = "nodejs"

const listTeams = makeFunctionReference<
    "query",
    TeamCollectionQuery & { secret: string; keyHash: string; guildId: string },
    TeamPage | null
>("teamReads:list")

export async function GET(request: Request) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) {
        auth.headers.set("Cache-Control", "no-store")
        return auth
    }
    const headers = { ...auth.headers, "Cache-Control": "no-store" },
        input = parseTeamCollectionQuery(request)
    if (!input)
        return teamErrorResponse(
            "invalid_query",
            headers,
            "One supported game and bounded pagination are required."
        )
    try {
        const page = await fetchQuery(listTeams, {
            secret: getInternalAuthSecret(),
            keyHash: hashApiKey(auth.key),
            guildId: auth.guildId,
            ...input,
        })
        // null means Convex refused the key, workspace or game grant.
        return page
            ? Response.json({ data: teamPageSchema.parse(page) }, { headers })
            : teamErrorResponse("insufficient_scope", headers)
    } catch {
        return teamErrorResponse("unavailable", headers)
    }
}
