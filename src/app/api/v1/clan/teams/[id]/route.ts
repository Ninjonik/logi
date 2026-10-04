import {
    parseTeamDetailQuery,
    parseTeamIdSegment,
    teamErrorResponse,
    type TeamDetailQuery,
} from "@/lib/api/teams-route"
import {
    authenticateClanRequest,
    isAuthError,
} from "@/lib/api/authenticated-clan-route"
import { teamDtoSchema, type TeamDto } from "@/domain/teams/team"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { hashApiKey } from "@/lib/public-api"
import { fetchQuery } from "convex/nextjs"
export const runtime = "nodejs"

const getTeam = makeFunctionReference<
    "query",
    TeamDetailQuery & {
        secret: string
        keyHash: string
        guildId: string
        id: string
    },
    { team: TeamDto | null } | null
>("teamReads:get")

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) {
        auth.headers.set("Cache-Control", "no-store")
        return auth
    }
    const headers = { ...auth.headers, "Cache-Control": "no-store" },
        id = parseTeamIdSegment((await context.params).id),
        input = parseTeamDetailQuery(request)
    if (!id || !input)
        return teamErrorResponse(
            "invalid_query",
            headers,
            "One supported game and an opaque team ID are required."
        )
    try {
        const result = await fetchQuery(getTeam, {
            secret: getInternalAuthSecret(),
            keyHash: hashApiKey(auth.key),
            guildId: auth.guildId,
            id,
            ...input,
        })
        // null means Convex refused the key, workspace or game grant; an
        // archived or foreign record reads as a generic not-found.
        if (!result) return teamErrorResponse("insufficient_scope", headers)
        if (!result.team) return teamErrorResponse("not_found", headers)
        return Response.json(
            { data: teamDtoSchema.parse(result.team) },
            { headers }
        )
    } catch {
        return teamErrorResponse("unavailable", headers)
    }
}
